import { Loader2, Trophy } from "lucide-react";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
import { AuctionPhaseHistoryView } from "./v2/AuctionPhaseHistoryView";
import { AuctionScheduledView } from "./v2/AuctionScheduledView";
import { AuctionLiveAnnouncements } from "./v2/AuctionLiveAnnouncements";
import { MobileEmptyState } from "@/components/mobile";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueAuctionStatus } from "@/hooks/useLeagueAuctionStatus";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsListMobile = ({ managerId }: AuctionsListProps) => {
  const { leagueId } = useLeague();
  const { data: auctionStatus, isLoading } = useLeagueAuctionStatus(leagueId);

  // Query pour récupérer l'historique des enchères terminées
  const { data: phaseHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['phase-history-check', leagueId],
    queryFn: async () => {
      // Récupérer la phase active de la ligue
      const { data: leagueScope } = await supabase
        .from('league_scopes')
        .select('phases, season_id')
        .eq('league_id', leagueId)
        .maybeSingle();

      if (!leagueScope?.phases?.length || !leagueScope.season_id) return null;

      // Récupérer les phases actives
      const { data: phases } = await supabase
        .from('phases')
        .select('id, budget, max_coureurs')
        .in('id', leagueScope.phases)
        .eq('statut', 'active');

      if (!phases?.length) return null;

      const phaseId = phases[0].id;

      // Vérifier s'il y a des rounds fermés
      const { data: closedRounds } = await supabase
        .from('auctions')
        .select('id')
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId)
        .eq('statut', 'closed')
        .limit(1);

      if (!closedRounds?.length) return null;

      // Récupérer les settings de la ligue
      const { data: league } = await supabase
        .from('leagues')
        .select('settings')
        .eq('id', leagueId)
        .maybeSingle();

      const settings = league?.settings as { budget?: number; max_riders?: number } | null;

      return {
        phaseId,
        budget: settings?.budget ?? phases[0].budget ?? 100,
        maxRiders: settings?.max_riders ?? phases[0].max_coureurs ?? 25,
      };
    },
    enabled: !isLoading && auctionStatus === null && !!leagueId,
  });

  if (isLoading || isLoadingHistory) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 1. Enchère ouverte → afficher l'interface d'enchères
  if (auctionStatus && !auctionStatus.isScheduled && !auctionStatus.isAnnouncementsPending) {
    return <AuctionPageV2 phaseId={auctionStatus.phaseId!} managerId={managerId} leagueId={leagueId} />;
  }

  // 2. Annonces en attente → afficher les résultats en direct
  if (auctionStatus?.isAnnouncementsPending && auctionStatus.phaseId) {
    return (
      <div className="p-4">
        <AuctionLiveAnnouncements
          auctionId={auctionStatus.auctionId}
          phaseId={auctionStatus.phaseId}
          managerId={managerId}
        />
      </div>
    );
  }

  // 3. Enchère programmée → afficher le compte à rebours
  if (auctionStatus?.isScheduled && auctionStatus.phaseId) {
    return (
      <AuctionScheduledView
        opensAt={auctionStatus.deadlineAt}
        roundNumber={auctionStatus.roundNumber}
        phaseId={auctionStatus.phaseId}
        leagueId={leagueId}
      />
    );
  }

  // 4. Enchères terminées avec historique disponible
  if (phaseHistory) {
    return (
      <AuctionPhaseHistoryView
        phaseId={phaseHistory.phaseId}
        managerId={managerId}
        leagueId={leagueId}
        budget={phaseHistory.budget}
        maxRiders={phaseHistory.maxRiders}
      />
    );
  }

  // 5. Aucune enchère active → état vide
  return (
    <MobileEmptyState
      icon={<Trophy className="h-16 w-16" />}
      title="Aucune enchère active"
      description="Aucun tour d'enchères actif pour le moment"
    />
  );
};
