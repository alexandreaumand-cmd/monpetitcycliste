import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeagueMember {
  id: string;
  name: string;
  joinedAt: string;
}

interface LeagueSeason {
  seasonId: string;
  season: {
    id: string;
    annee: number;
  };
}

interface AuctionStatus {
  auctionId: string;
  phaseId: string | null;
  roundNumber: number;
  validatedCount: number;
  totalManagers: number;
  deadlineAt: string;
  isScheduled?: boolean;
  isAnnouncementsPending?: boolean;
}

interface LeagueStats {
  mySeasonRank: number | null;
  mySeasonPoints: number | null;
  myPhaseRank: number | null;
  myPhasePoints: number | null;
  seasonLeader: { name: string; points: number } | null;
}

export interface LeagueCardData {
  members: LeagueMember[];
  memberCount: number;
  owner: { id: string; nom: string } | null;
  season: LeagueSeason | null;
  stats: LeagueStats | null;
  auctionStatus: AuctionStatus | null;
  selectedCourseNames: string[];
}

interface LeagueInfo {
  id: string;
  owner_manager_id: string;
  status: string;
}

export function useLeagueCardsData(leagues: LeagueInfo[]) {
  return useQuery({
    queryKey: ['league-cards-data', leagues.map(l => l.id).join(',')],
    queryFn: async (): Promise<Record<string, LeagueCardData>> => {
      if (leagues.length === 0) return {};

      const leagueIds = leagues.map(l => l.id);
      const ownerManagerIds = [...new Set(leagues.map(l => l.owner_manager_id).filter(Boolean))];
      const activeLeagueIds = leagues.filter(l => l.status === 'active').map(l => l.id);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      let currentManagerId: string | null = null;
      
      if (user) {
        const { data: manager } = await supabase
          .from('managers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        currentManagerId = manager?.id || null;
      }

      // BATCH 1: Fetch all league members
      const { data: allMembersRaw } = await supabase
        .from('league_members')
        .select('id, league_id, user_id, joined_at')
        .in('league_id', leagueIds)
        .order('joined_at', { ascending: true });

      // Get unique user IDs for manager name resolution
      const userIds = [...new Set((allMembersRaw || []).map(m => m.user_id))];

      // BATCH 2: Fetch all manager names
      const { data: allManagers } = userIds.length > 0
        ? await supabase
            .from('managers')
            .select('user_id, nom')
            .in('user_id', userIds)
        : { data: [] };

      const managerNameMap = new Map((allManagers || []).map(m => [m.user_id, m.nom]));

      // BATCH 3: Fetch all owners
      const { data: allOwners } = ownerManagerIds.length > 0
        ? await supabase
            .from('managers')
            .select('id, nom')
            .in('id', ownerManagerIds)
        : { data: [] };

      const ownersMap = new Map((allOwners || []).map(o => [o.id, o]));

      // BATCH 4: Fetch all league_scopes and seasons separately
      const { data: allScopes } = await supabase
        .from('league_scopes')
        .select('league_id, season_id, selected_course_ids')
        .in('league_id', leagueIds);

      const scopeSeasonIds = [...new Set((allScopes || []).map(s => s.season_id).filter(Boolean))];
      
      const { data: allSeasons } = scopeSeasonIds.length > 0
        ? await supabase
            .from('saisons')
            .select('id, annee')
            .in('id', scopeSeasonIds)
        : { data: [] };

      const seasonsMap = new Map((allSeasons || []).map(s => [s.id, s]));

      // BATCH 5: Fetch all standings (always, regardless of currentManagerId)
      const { data: allStandings } = await supabase
        .from('v_manager_standings_by_season_v2')
        .select('*')
        .in('league_id', leagueIds);

      // BATCH 6: Fetch phases for active leagues (needed for auction status)
      const seasonIds = [...new Set((allScopes || []).map(s => s.season_id).filter(Boolean))];
      const { data: allPhases } = seasonIds.length > 0
        ? await supabase
            .from('phases')
            .select('id, saison_id, date_debut, date_fin, index_dans_saison')
            .in('saison_id', seasonIds)
            .order('index_dans_saison', { ascending: true })
        : { data: [] };

      // BATCH 7: Fetch all auctions (open, closed, scheduled) for active leagues
      const { data: allAuctions } = activeLeagueIds.length > 0
        ? await supabase
            .from('auctions')
            .select('id, league_id, phase_id, round_number, statut, deadline_at, closed_at, opens_at, created_at')
            .in('league_id', activeLeagueIds)
            .in('statut', ['open', 'closed', 'scheduled'])
            .order('created_at', { ascending: false })
        : { data: [] };

      // BATCH 8: Check for unpublished announcements on closed auctions
      const closedAuctionIds = (allAuctions || [])
        .filter(a => a.statut === 'closed')
        .map(a => a.id);
      
      const { data: unpublishedAnnonces } = closedAuctionIds.length > 0
        ? await supabase
            .from('annonces')
            .select('auction_id')
            .in('auction_id', closedAuctionIds)
            .eq('published', false)
        : { data: [] };

      const auctionsWithPendingAnnonces = new Set(
        (unpublishedAnnonces || []).map(a => a.auction_id)
      );

      // BATCH 9: Fetch validation status for open auctions
      const openAuctions = (allAuctions || []).filter(a => a.statut === 'open');
      const validationStatusMap = new Map<string, { validated_count: number; total_managers: number }>();
      
      if (openAuctions.length > 0) {
        const validationPromises = openAuctions.map(async (auction) => {
          try {
            const { data } = await supabase.functions.invoke('auction-get-validation-status', {
              body: { auction_id: auction.id, league_id: auction.league_id }
            });
            if (data) {
              validationStatusMap.set(auction.id, {
                validated_count: data.validated_count ?? 0,
                total_managers: data.total_managers ?? 0,
              });
            }
          } catch (e) {
            console.warn(`Failed to fetch validation status for auction ${auction.id}`, e);
          }
        });
        await Promise.all(validationPromises);
      }

      // Build helper maps
      const scopesByLeague = new Map<string, typeof allScopes[0]>();
      (allScopes || []).forEach(s => scopesByLeague.set(s.league_id, s));

      const phasesBySeason = new Map<string, typeof allPhases>();
      (allPhases || []).forEach(p => {
        const arr = phasesBySeason.get(p.saison_id) || [];
        arr.push(p);
        phasesBySeason.set(p.saison_id, arr);
      });

      // Build result map
      const result: Record<string, LeagueCardData> = {};

      for (const league of leagues) {
        // Members
        const leagueMembers = (allMembersRaw || [])
          .filter(m => m.league_id === league.id)
          .map(m => ({
            id: m.id,
            name: managerNameMap.get(m.user_id) || 'Inconnu',
            joinedAt: m.joined_at
          }));

        // Owner
        const owner = ownersMap.get(league.owner_manager_id) || null;

        // Season
        const scope = scopesByLeague.get(league.id);
        const seasonData = scope?.season_id ? seasonsMap.get(scope.season_id) : null;
        const season: LeagueSeason | null = seasonData
          ? {
              seasonId: seasonData.id,
              season: {
                id: seasonData.id,
                annee: seasonData.annee
              }
            }
          : null;

        // Stats
        let stats: LeagueStats | null = null;
        if (season && allStandings) {
          const leagueStandings = allStandings
            .filter(s => s.league_id === league.id && s.saison_id === season.seasonId)
            .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

          if (leagueStandings.length > 0) {
            const myIndex = currentManagerId 
              ? leagueStandings.findIndex(s => s.manager_id === currentManagerId)
              : -1;

            stats = {
              mySeasonRank: myIndex >= 0 ? myIndex + 1 : null,
              mySeasonPoints: myIndex >= 0 ? leagueStandings[myIndex].total_points : null,
              myPhaseRank: null,
              myPhasePoints: null,
              seasonLeader: leagueStandings[0] 
                ? { name: leagueStandings[0].manager_nom, points: leagueStandings[0].total_points }
                : null
            };
          }
        }

        // Auction status (only for active leagues)
        let auctionStatus: AuctionStatus | null = null;
        if (league.status === 'active' && season) {
          const phases = phasesBySeason.get(season.seasonId) || [];
          const today = new Date().toISOString().split('T')[0];

          // Determine active phase
          let activePhaseId: string | null = null;
          const currentPhase = phases.find(p => p.date_debut <= today && today <= p.date_fin);
          if (currentPhase) {
            activePhaseId = currentPhase.id;
          } else {
            const nextPhase = phases.find(p => p.date_debut > today);
            activePhaseId = nextPhase?.id || phases[phases.length - 1]?.id || null;
          }

          // Find relevant auction
          const leagueAuctions = (allAuctions || []).filter(a => a.league_id === league.id);
          
          // Priority 1: Any open auction across all phases
          const openAuction = leagueAuctions.find(a => a.statut === 'open');

          if (openAuction) {
            const validation = validationStatusMap.get(openAuction.id);
            auctionStatus = {
              auctionId: openAuction.id,
              phaseId: openAuction.phase_id,
              roundNumber: openAuction.round_number,
              validatedCount: validation?.validated_count ?? 0,
              totalManagers: validation?.total_managers ?? leagueMembers.length,
              deadlineAt: openAuction.deadline_at,
            };
          } else {
            // Priority 2: Closed with pending (prefer active phase, fallback any)
            const closedWithPending = leagueAuctions.find(
              a => a.statut === 'closed' && 
                   auctionsWithPendingAnnonces.has(a.id) &&
                   a.phase_id === activePhaseId
            ) || leagueAuctions.find(
              a => a.statut === 'closed' && 
                   auctionsWithPendingAnnonces.has(a.id)
            );

            if (closedWithPending) {
              auctionStatus = {
                auctionId: closedWithPending.id,
                phaseId: closedWithPending.phase_id,
                roundNumber: closedWithPending.round_number,
                validatedCount: 0,
                totalManagers: 0,
                deadlineAt: closedWithPending.closed_at || new Date().toISOString(),
                isAnnouncementsPending: true,
              };
            } else {
              // Priority 3: Scheduled (active phase only — no cross-phase fallback)
              const now = new Date().toISOString();
              const scheduled = activePhaseId ? leagueAuctions.find(
                a => a.statut === 'scheduled' && 
                     a.opens_at && a.opens_at > now &&
                     a.phase_id === activePhaseId
              ) : null;

              if (scheduled) {
                auctionStatus = {
                  auctionId: scheduled.id,
                  phaseId: scheduled.phase_id,
                  roundNumber: scheduled.round_number,
                  validatedCount: 0,
                  totalManagers: 0,
                  deadlineAt: scheduled.opens_at!,
                  isScheduled: true,
                };
              }
            }
          }
        }

        // Selected course names (for per_course leagues)
        const scopeData = scopesByLeague.get(league.id);
        const selectedCourseNames: string[] = ((scopeData as any)?.selected_course_ids as string[] || [])
          .map(id => courseNameMap.get(id))
          .filter((n): n is string => !!n);

        result[league.id] = {
          members: leagueMembers,
          memberCount: leagueMembers.length,
          owner,
          season,
          stats,
          auctionStatus,
          selectedCourseNames,
        };
      }

      return result;
    },
    enabled: leagues.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
}
