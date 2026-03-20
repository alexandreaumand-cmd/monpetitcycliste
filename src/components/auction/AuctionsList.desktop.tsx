import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
import { AuctionPhaseHistoryView } from "./v2/AuctionPhaseHistoryView";
import { AuctionScheduledView } from "./v2/AuctionScheduledView";
import { AuctionLiveAnnouncements } from "./v2/AuctionLiveAnnouncements";
import { AuctionPhaseSelector } from "./AuctionPhaseSelector";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueAuctionStatus } from "@/hooks/useLeagueAuctionStatus";
import { useLeagueAuctionPhases } from "@/hooks/useLeagueAuctionPhases";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsList = ({ managerId }: AuctionsListProps) => {
  const { leagueId } = useLeague();
  const { data: auctionStatus, isLoading } = useLeagueAuctionStatus(leagueId);
  const { data: auctionPhases = [], isLoading: isLoadingPhases } = useLeagueAuctionPhases(leagueId);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [manualPhaseId, setManualPhaseId] = useState<string | null>(null);

  // Query pour récupérer l'historique des enchères terminées
  const { data: phaseHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['phase-history-check', leagueId],
    queryFn: async () => {
      const { data: leagueScope } = await supabase
        .from('league_scopes')
        .select('phases, season_id')
        .eq('league_id', leagueId)
        .maybeSingle();

      if (!leagueScope?.phases?.length || !leagueScope.season_id) return null;

      const { data: phases } = await supabase
        .from('phases')
        .select('id, budget, max_coureurs')
        .in('id', leagueScope.phases)
        .eq('statut', 'active');

      if (!phases?.length) return null;

      const phaseId = phases[0].id;

      const { data: closedRounds } = await supabase
        .from('auctions')
        .select('id')
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId)
        .eq('statut', 'closed')
        .limit(1);

      if (!closedRounds?.length) return null;

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

  if (isLoading || isLoadingHistory || isLoadingPhases) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Determine the current "live" phase (from auction status or history)
  const livePhaseId = auctionStatus?.phaseId || phaseHistory?.phaseId || null;

  // If user manually selected a different phase, show its history
  if (manualPhaseId && manualPhaseId !== livePhaseId) {
    const phaseInfo = auctionPhases.find((p) => p.phaseId === manualPhaseId);
    if (phaseInfo) {
      return (
        <div>
          <div className="container max-w-7xl mx-auto px-4 md:px-6 pt-4">
            <AuctionPhaseSelector
              phases={auctionPhases}
              selectedPhaseId={manualPhaseId}
              onPhaseChange={setManualPhaseId}
            />
          </div>
          <AuctionPhaseHistoryView
            phaseId={manualPhaseId}
            managerId={managerId}
            leagueId={leagueId}
            budget={phaseInfo.budget}
            maxRiders={phaseInfo.maxRiders}
          />
        </div>
      );
    }
  }

  // Phase selector helper - renders the selector above the current view
  const renderPhaseSelector = (currentPhaseId: string) => {
    if (auctionPhases.length <= 1) return null;
    return (
      <div className="container max-w-7xl mx-auto px-4 md:px-6 pt-4">
        <AuctionPhaseSelector
          phases={auctionPhases}
          selectedPhaseId={manualPhaseId || currentPhaseId}
          onPhaseChange={setManualPhaseId}
        />
      </div>
    );
  };

  // 0. Tab "announcements" demandé explicitement
  if (tabParam === 'announcements' && auctionStatus?.phaseId && auctionStatus?.auctionId) {
    return (
      <div>
        {renderPhaseSelector(auctionStatus.phaseId)}
        <div className="container max-w-6xl mx-auto p-6">
          <AuctionLiveAnnouncements
            auctionId={auctionStatus.auctionId}
            phaseId={auctionStatus.phaseId}
            managerId={managerId}
          />
        </div>
      </div>
    );
  }

  // 1. Enchère ouverte
  if (auctionStatus && !auctionStatus.isScheduled && !auctionStatus.isAnnouncementsPending) {
    return (
      <div>
        {renderPhaseSelector(auctionStatus.phaseId!)}
        <AuctionPageV2 phaseId={auctionStatus.phaseId!} managerId={managerId} leagueId={leagueId} />
      </div>
    );
  }

  // 2. Annonces en attente
  if (auctionStatus?.isAnnouncementsPending && auctionStatus.phaseId) {
    return (
      <div>
        {renderPhaseSelector(auctionStatus.phaseId)}
        <div className="container max-w-6xl mx-auto p-6">
          <AuctionLiveAnnouncements
            auctionId={auctionStatus.auctionId}
            phaseId={auctionStatus.phaseId}
            managerId={managerId}
          />
        </div>
      </div>
    );
  }

  // 3. Enchère programmée
  if (auctionStatus?.isScheduled && auctionStatus.phaseId) {
    return (
      <div>
        {renderPhaseSelector(auctionStatus.phaseId)}
        <AuctionScheduledView
          opensAt={auctionStatus.deadlineAt}
          roundNumber={auctionStatus.roundNumber}
          phaseId={auctionStatus.phaseId}
          leagueId={leagueId}
        />
      </div>
    );
  }

  // 4. Enchères terminées avec historique
  if (phaseHistory) {
    return (
      <div>
        {renderPhaseSelector(phaseHistory.phaseId)}
        <AuctionPhaseHistoryView
          phaseId={phaseHistory.phaseId}
          managerId={managerId}
          leagueId={leagueId}
          budget={phaseHistory.budget}
          maxRiders={phaseHistory.maxRiders}
        />
      </div>
    );
  }

  // 5. Aucune enchère active → si des phases existent, montrer le sélecteur avec la première
  if (auctionPhases.length > 0) {
    const firstPhase = auctionPhases[0];
    return (
      <div>
        <div className="container max-w-7xl mx-auto px-4 md:px-6 pt-4">
          <AuctionPhaseSelector
            phases={auctionPhases}
            selectedPhaseId={manualPhaseId || firstPhase.phaseId}
            onPhaseChange={setManualPhaseId}
          />
        </div>
        <AuctionPhaseHistoryView
          phaseId={manualPhaseId || firstPhase.phaseId}
          managerId={managerId}
          leagueId={leagueId}
          budget={firstPhase.budget}
          maxRiders={firstPhase.maxRiders}
        />
      </div>
    );
  }

  // 6. Vraiment rien
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
