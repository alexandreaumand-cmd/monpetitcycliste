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
  isPastScheduled?: boolean;
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

      // ── STAGE 1: Independent queries (no dependencies) ──
      const [
        { data: { user } },
        { data: allMembersRaw },
        { data: allScopes },
        ownersResult,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('league_members')
          .select('id, league_id, user_id, joined_at')
          .in('league_id', leagueIds)
          .order('joined_at', { ascending: true }),
        supabase
          .from('league_scopes')
          .select('league_id, season_id, selected_course_ids')
          .in('league_id', leagueIds),
        ownerManagerIds.length > 0
          ? supabase.from('managers').select('id, nom').in('id', ownerManagerIds)
          : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
      ]);

      // Derived values from stage 1
      const userIds = [...new Set((allMembersRaw || []).map(m => m.user_id))];
      const scopeSeasonIds = [...new Set((allScopes || []).map(s => s.season_id).filter(Boolean))];
      const allSelectedCourseIds = [...new Set(
        (allScopes || []).flatMap(s => (s.selected_course_ids as string[]) || []).filter(Boolean)
      )];

      let currentManagerId: string | null = null;

      // ── STAGE 2: Queries depending on stage 1 results ──
      const [
        managerResult,
        managersNamesResult,
        seasonsResult,
        coursesResult,
        { data: allStandings },
        phasesResult,
        auctionsResult,
      ] = await Promise.all([
        user
          ? supabase.from('managers').select('id').eq('user_id', user.id).single()
          : Promise.resolve({ data: null }),
        userIds.length > 0
          ? supabase.from('managers').select('user_id, nom').in('user_id', userIds)
          : Promise.resolve({ data: [] as { user_id: string; nom: string }[] }),
        scopeSeasonIds.length > 0
          ? supabase.from('saisons').select('id, annee').in('id', scopeSeasonIds)
          : Promise.resolve({ data: [] as { id: string; annee: number }[] }),
        allSelectedCourseIds.length > 0
          ? supabase.from('courses').select('id, nom').in('id', allSelectedCourseIds)
          : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
        supabase
          .from('v_manager_standings_by_season_v2')
          .select('*')
          .in('league_id', leagueIds),
        scopeSeasonIds.length > 0
          ? supabase.from('phases').select('id, saison_id, date_debut, date_fin, index_dans_saison').in('saison_id', scopeSeasonIds).order('index_dans_saison', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        activeLeagueIds.length > 0
          ? supabase.from('auctions').select('id, league_id, phase_id, round_number, statut, deadline_at, closed_at, opens_at, created_at').in('league_id', activeLeagueIds).in('statut', ['open', 'closed', 'scheduled']).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      currentManagerId = managerResult?.data?.id || null;
      const allManagers = managersNamesResult?.data || [];
      const allOwners = ownersResult?.data || [];
      const allSeasons = seasonsResult?.data || [];
      const allSelectedCourses = coursesResult?.data || [];
      const allPhases = phasesResult?.data || [];
      const allAuctions = auctionsResult?.data || [];

      // ── STAGE 3: Queries depending on stage 2 (auctions) ──
      const closedAuctionIds = allAuctions.filter(a => a.statut === 'closed').map(a => a.id);
      const openAuctions = allAuctions.filter(a => a.statut === 'open');

      const [unpublishedResult, ...validationResults] = await Promise.all([
        closedAuctionIds.length > 0
          ? supabase.from('annonces').select('auction_id').in('auction_id', closedAuctionIds).eq('published', false)
          : Promise.resolve({ data: [] as { auction_id: string }[] }),
        ...openAuctions.map(auction =>
          supabase.functions.invoke('auction-get-validation-status', {
            body: { auction_id: auction.id, league_id: auction.league_id }
          }).then(({ data }) => ({ auctionId: auction.id, data })).catch(() => ({ auctionId: auction.id, data: null }))
        ),
      ]);

      const auctionsWithPendingAnnonces = new Set(
        (unpublishedResult?.data || []).map(a => a.auction_id)
      );

      const validationStatusMap = new Map<string, { validated_count: number; total_managers: number }>();
      for (const v of validationResults) {
        if (v.data) {
          validationStatusMap.set(v.auctionId, {
            validated_count: v.data.validated_count ?? 0,
            total_managers: v.data.total_managers ?? 0,
          });
        }
      }

      // ── Build helper maps ──
      const managerNameMap = new Map(allManagers.map(m => [m.user_id, m.nom]));
      const ownersMap = new Map(allOwners.map(o => [o.id, o]));
      const seasonsMap = new Map(allSeasons.map(s => [s.id, s]));
      const courseNameMap = new Map(allSelectedCourses.map(c => [c.id, c.nom]));

      const scopesByLeague = new Map<string, (typeof allScopes)[0]>();
      (allScopes || []).forEach(s => scopesByLeague.set(s.league_id, s));

      const phasesBySeason = new Map<string, typeof allPhases>();
      allPhases.forEach(p => {
        const arr = phasesBySeason.get(p.saison_id) || [];
        arr.push(p);
        phasesBySeason.set(p.saison_id, arr);
      });

      // ── Build result map ──
      const result: Record<string, LeagueCardData> = {};

      for (const league of leagues) {
        const leagueMembers = (allMembersRaw || [])
          .filter(m => m.league_id === league.id)
          .map(m => ({
            id: m.id,
            name: managerNameMap.get(m.user_id) || 'Inconnu',
            joinedAt: m.joined_at
          }));

        const owner = ownersMap.get(league.owner_manager_id) || null;

        const scope = scopesByLeague.get(league.id);
        const seasonData = scope?.season_id ? seasonsMap.get(scope.season_id) : null;
        const season: LeagueSeason | null = seasonData
          ? { seasonId: seasonData.id, season: { id: seasonData.id, annee: seasonData.annee } }
          : null;

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

        let auctionStatus: AuctionStatus | null = null;
        if (league.status === 'active' && season) {
          const phases = phasesBySeason.get(season.seasonId) || [];
          const today = new Date().toISOString().split('T')[0];

          let activePhaseId: string | null = null;
          const currentPhase = phases.find(p => p.date_debut <= today && today <= p.date_fin);
          if (currentPhase) {
            activePhaseId = currentPhase.id;
          } else {
            const nextPhase = phases.find(p => p.date_debut > today);
            activePhaseId = nextPhase?.id || phases[phases.length - 1]?.id || null;
          }

          const leagueAuctions = allAuctions.filter(a => a.league_id === league.id);
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
            const closedWithPending = leagueAuctions.find(
              a => a.statut === 'closed' && auctionsWithPendingAnnonces.has(a.id) && a.phase_id === activePhaseId
            ) || leagueAuctions.find(
              a => a.statut === 'closed' && auctionsWithPendingAnnonces.has(a.id)
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
              const now = new Date().toISOString();
              const scheduled = activePhaseId ? leagueAuctions.find(
                a => a.statut === 'scheduled' && a.opens_at && a.opens_at > now && a.phase_id === activePhaseId
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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
