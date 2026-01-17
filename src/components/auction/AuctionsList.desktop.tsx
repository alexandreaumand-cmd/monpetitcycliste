import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
import { AuctionPhaseHistoryView } from "./v2/AuctionPhaseHistoryView";
import { AuctionScheduledView } from "./v2/AuctionScheduledView";
import { AuctionLiveAnnouncements } from "./v2/AuctionLiveAnnouncements";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueAuctionStatus } from "@/hooks/useLeagueAuctionStatus";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsList = ({ managerId }: AuctionsListProps) => {
  const { leagueId } = useLeague();
  const { data: auctionStatus, isLoading } = useLeagueAuctionStatus(leagueId);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
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
      <div className="container max-w-6xl mx-auto p-6">
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

  // 4. Mode historique → afficher l'historique de la dernière phase
  if (auctionStatus?.isHistoryMode && auctionStatus.phaseId) {
    return (
      <AuctionPhaseHistoryView
        phaseId={auctionStatus.phaseId}
        managerId={managerId}
        leagueId={leagueId}
        budget={0}
        maxRiders={0}
      />
    );
  }

  // 5. Aucune enchère active → message vide
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enchères</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-8">
          Aucun tour d'enchères actif pour le moment
        </p>
      </CardContent>
    </Card>
  );
};
