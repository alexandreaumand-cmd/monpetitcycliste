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

      // Étape 1: Récupérer la saison de la ligue
      const { data: scopeData } = await supabase
        .from('league_scopes')
        .select('season_id')
        .eq('league_id', leagueId)
        .maybeSingle();

      if (!scopeData?.season_id) return null;

      // Étape 2: Récupérer la phase active de cette saison
      const { data: phaseData } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', scopeData.season_id)
        .eq('statut', 'auction_open')
        .maybeSingle();

      if (!phaseData?.id) return null;

      // Étape 3: Récupérer l'enchère ouverte pour cette ligue et phase
      const { data: auctionData } = await supabase
        .from('auctions')
        .select('id, round_number, deadline_at, phase_id')
        .eq('league_id', leagueId)
        .eq('phase_id', phaseData.id)
        .eq('statut', 'open')
        .maybeSingle();

      if (!auctionData) return null;

      // Étape 4: Appeler la fonction edge pour le statut de validation
      const { data: validationData, error } = await supabase.functions.invoke(
        'auction-get-validation-status',
        {
          body: { phase_id: phaseData.id }
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
