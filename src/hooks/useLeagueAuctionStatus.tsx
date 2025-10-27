import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuctionStatus {
  auctionId: string;
  phaseId: string;
  roundNumber: number;
  validatedCount: number;
  totalManagers: number;
  deadlineAt: string;
}

export function useLeagueAuctionStatus(leagueId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['league-auction-status', leagueId],
    queryFn: async (): Promise<AuctionStatus | null> => {
      if (!leagueId) return null;

      // Récupérer l'enchère ouverte pour cette ligue
      const { data: auctionData } = await supabase
        .from('auctions')
        .select('id, round_number, deadline_at, phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'open')
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!auctionData) return null;

      // Appeler la fonction edge pour le statut de validation
      const { data: validationData, error } = await supabase.functions.invoke(
        'auction-get-validation-status',
        {
          body: { phase_id: auctionData.phase_id, league_id: leagueId }
        }
      );

      if (error || !validationData) {
        console.error('Error fetching validation status:', error);
        return null;
      }

      return {
        auctionId: auctionData.id,
        phaseId: auctionData.phase_id,
        roundNumber: auctionData.round_number,
        validatedCount: validationData.validated_count,
        totalManagers: validationData.total_managers,
        deadlineAt: auctionData.deadline_at,
      };
    },
    enabled: enabled && !!leagueId,
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });
}
