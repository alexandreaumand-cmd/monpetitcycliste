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
}

export function useLeagueAuctionStatus(leagueId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['league-auction-status', leagueId],
    queryFn: async (): Promise<AuctionStatus | null> => {
      if (!leagueId) return null;

      // 1. Chercher une enchère OUVERTE
      const { data: openAuction } = await supabase
        .from('auctions')
        .select('id, round_number, deadline_at, phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'open')
        .not('phase_id', 'is', null)  // ✅ Filtrer les enchères fantômes
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

      // 2. Si aucune enchère ouverte, chercher une enchère SCHEDULED (future uniquement)
      const { data: scheduledAuction } = await supabase
        .from('auctions')
        .select('id, round_number, opens_at, phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'scheduled')
        .gt('opens_at', new Date().toISOString())
        .order('opens_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (scheduledAuction) {
        // Pour une enchère scheduled, pas de validation status
        return {
          auctionId: scheduledAuction.id,
          phaseId: scheduledAuction.phase_id,
          roundNumber: scheduledAuction.round_number,
          validatedCount: 0,
          totalManagers: 0,
          deadlineAt: scheduledAuction.opens_at,
          isScheduled: true,
        };
      }

      return null;
    },
    enabled: enabled && !!leagueId,
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });
}
