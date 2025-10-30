import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy } from "lucide-react";
import { AuctionPage } from "./AuctionPage";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
import { AuctionPhaseHistoryView } from "./v2/AuctionPhaseHistoryView";
import { MobileEmptyState } from "@/components/mobile";
import { useLeague } from "@/contexts/LeagueContext";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsListMobile = ({ managerId }: AuctionsListProps) => {
  const { leagueId } = useLeague();
  const { data: activeAuctions, isLoading } = useQuery({
    queryKey: ['my-active-auctions', leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      if (!leagueId) return null;
      
      const { data, error } = await supabase
        .from('auctions')
        .select('phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'open')
        .order('opens_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: closedAuctions, isLoading: isLoadingClosed } = useQuery({
    queryKey: ['my-closed-auctions', leagueId],
    enabled: !!leagueId && (!activeAuctions || activeAuctions.length === 0),
    queryFn: async () => {
      if (!leagueId) return null;
      
      const { data, error } = await supabase
        .from('auctions')
        .select('phase_id')
        .eq('league_id', leagueId)
        .eq('statut', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading || isLoadingClosed) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si une enchère est ouverte
  if (activeAuctions && activeAuctions.length > 0) {
    return <AuctionPageV2 phaseId={activeAuctions[0].phase_id} managerId={managerId} leagueId={leagueId} />;
  }

  // Si des enchères fermées existent
  if (closedAuctions && closedAuctions.length > 0) {
    return (
      <AuctionPhaseHistoryView 
        phaseId={closedAuctions[0].phase_id}
        managerId={managerId}
        leagueId={leagueId}
        budget={0}
        maxRiders={25}
      />
    );
  }

  // Aucune enchère
  return (
    <MobileEmptyState
      icon={<Trophy className="h-16 w-16" />}
      title="Aucune enchère active"
      description="Aucune phase d'enchères n'est ouverte pour le moment"
    />
  );
};
