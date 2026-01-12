import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useLeagueAuctionStatus(leagueId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['league-auction-status', leagueId],
    queryFn: async (): Promise<AuctionStatus | null> => {
      if (!leagueId) return null;

      // 0. Déterminer la phase active basée sur le calendrier
      // 0a. Récupérer la saison de la ligue via league_scopes
      const { data: scopeData } = await supabase
        .from('league_scopes')
        .select('season_id')
        .eq('league_id', leagueId)
        .single();

      let activePhaseId: string | null = null;

      if (scopeData?.season_id) {
        // 0b. Charger toutes les phases de cette saison
        const { data: phases } = await supabase
          .from('phases')
          .select('id, date_debut, date_fin, index_dans_saison')
          .eq('saison_id', scopeData.season_id)
          .order('index_dans_saison', { ascending: true });

        if (phases && phases.length > 0) {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

          // Phase en cours (today entre date_debut et date_fin)
          const currentPhase = phases.find(p => 
            p.date_debut <= today && today <= p.date_fin
          );

          if (currentPhase) {
            activePhaseId = currentPhase.id;
          } else {
            // Sinon, prochaine phase à venir
            const nextPhase = phases.find(p => p.date_debut > today);
            if (nextPhase) {
              activePhaseId = nextPhase.id;
            } else {
              // Sinon, dernière phase (saison terminée)
              activePhaseId = phases[phases.length - 1].id;
            }
          }
        }
      }

      // 1. Chercher une enchère OUVERTE (sur la phase active si définie)
      let openAuctionQuery = supabase
        .from('auctions')
        .select('id, round_number, deadline_at, phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'open')
        .not('phase_id', 'is', null);

      if (activePhaseId) {
        openAuctionQuery = openAuctionQuery.eq('phase_id', activePhaseId);
      }

      const { data: openAuction } = await openAuctionQuery
        .order('round_number', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openAuction) {
        // Récupérer le statut de validation pour l'enchère ouverte
        const { data: validationData, error } = await supabase.functions.invoke(
          'auction-get-validation-status',
          {
            body: { auction_id: openAuction.id, league_id: leagueId }
          }
        );

        if (error || !validationData) {
          console.error('Error fetching validation status:', error);
          return null;
        }

        return {
          auctionId: openAuction.id,
          phaseId: openAuction.phase_id,
          roundNumber: openAuction.round_number,
          validatedCount: validationData.validated_count,
          totalManagers: validationData.total_managers,
          deadlineAt: openAuction.deadline_at,
        };
      }

      // 2. Si aucune enchère ouverte, chercher une enchère FERMÉE avec annonces non publiées
      let closedAuctionQuery = supabase
        .from('auctions')
        .select('id, round_number, closed_at, phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'closed');

      if (activePhaseId) {
        closedAuctionQuery = closedAuctionQuery.eq('phase_id', activePhaseId);
      }

      const { data: closedAuction } = await closedAuctionQuery
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (closedAuction) {
        // Vérifier s'il reste des annonces non publiées
        const { count } = await supabase
          .from('annonces')
          .select('*', { count: 'exact', head: true })
          .eq('auction_id', closedAuction.id)
          .eq('published', false);

        if (count && count > 0) {
          return {
            auctionId: closedAuction.id,
            phaseId: closedAuction.phase_id,
            roundNumber: closedAuction.round_number,
            validatedCount: 0,
            totalManagers: 0,
            deadlineAt: closedAuction.closed_at || new Date().toISOString(),
            isAnnouncementsPending: true,
          };
        }
      }

      // 3. Si aucune enchère fermée avec annonces, chercher une enchère SCHEDULED (sur la phase active si définie)
      let scheduledAuctionQuery = supabase
        .from('auctions')
        .select('id, round_number, opens_at, phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'scheduled')
        .gt('opens_at', new Date().toISOString());

      if (activePhaseId) {
        scheduledAuctionQuery = scheduledAuctionQuery.eq('phase_id', activePhaseId);
      }

      const { data: scheduledAuction } = await scheduledAuctionQuery
        .order('opens_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (scheduledAuction) {
        // Pour une enchère scheduled, on retourne opensAt dans deadlineAt pour le countdown
        return {
          auctionId: scheduledAuction.id,
          phaseId: scheduledAuction.phase_id,
          roundNumber: scheduledAuction.round_number,
          validatedCount: 0,
          totalManagers: 0,
          deadlineAt: scheduledAuction.opens_at, // Utilisé pour le countdown
          isScheduled: true,
        };
      }

      return null;
    },
    enabled: enabled && !!leagueId,
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });
}
