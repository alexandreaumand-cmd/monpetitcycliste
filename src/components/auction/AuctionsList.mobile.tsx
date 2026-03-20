import { Loader2, Trophy } from "lucide-react";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
import { AuctionPhaseHistoryView } from "./v2/AuctionPhaseHistoryView";
import { AuctionScheduledView } from "./v2/AuctionScheduledView";
import { AuctionLiveAnnouncements } from "./v2/AuctionLiveAnnouncements";
import { AuctionPhaseSelector } from "./AuctionPhaseSelector";
import { MobileEmptyState } from "@/components/mobile";
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

export const AuctionsListMobile = ({ managerId }: AuctionsListProps) => {
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
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const livePhaseId = auctionStatus?.phaseId || phaseHistory?.phaseId || null;

  // If user manually selected a different phase
  if (manualPhaseId && manualPhaseId !== livePhaseId) {
    const phaseInfo = auctionPhases.find((p) => p.phaseId === manualPhaseId);
    if (phaseInfo) {
      return (
        <div>
          <div className="px-4 pt-3">
            <AuctionPhaseSelector
              phases={auctionPhases}
              selectedPhaseId={manualPhaseId}
              onPhaseChange={setManualPhaseId}
              compact
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

  const renderPhaseSelector = (currentPhaseId: string) => {
    if (auctionPhases.length <= 1) return null;
    return (
      <div className="px-4 pt-3">
        <AuctionPhaseSelector
          phases={auctionPhases}
          selectedPhaseId={manualPhaseId || currentPhaseId}
          onPhaseChange={setManualPhaseId}
          compact
        />
      </div>
    );
  };

  // 0. Tab "announcements"
  if (tabParam === 'announcements' && auctionStatus?.phaseId && auctionStatus?.auctionId) {
    return (
      <div>
        {renderPhaseSelector(auctionStatus.phaseId)}
        <div className="p-4">
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
        <div className="p-4">
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

  // 5. Des phases avec enchères existent
  if (auctionPhases.length > 0) {
    const firstPhase = auctionPhases[0];
    return (
      <div>
        <div className="px-4 pt-3">
          <AuctionPhaseSelector
            phases={auctionPhases}
            selectedPhaseId={manualPhaseId || firstPhase.phaseId}
            onPhaseChange={setManualPhaseId}
            compact
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

  // 6. Rien
  return (
    <MobileEmptyState
      icon={<Trophy className="h-16 w-16" />}
      title="Aucune enchère active"
      description="Aucun tour d'enchères actif pour le moment"
    />
  );
};
