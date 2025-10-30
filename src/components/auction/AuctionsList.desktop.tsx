import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AuctionPage } from "./AuctionPage";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
import { AuctionPhaseHistoryView } from "./v2/AuctionPhaseHistoryView";
import { useLeague } from "@/contexts/LeagueContext";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsList = ({ managerId }: AuctionsListProps) => {
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
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Si une enchère est ouverte → afficher l'interface d'enchères
  if (activeAuctions && activeAuctions.length > 0) {
    return <AuctionPageV2 phaseId={activeAuctions[0].phase_id} managerId={managerId} leagueId={leagueId} />;
  }

  // Si aucune enchère ouverte MAIS des enchères fermées → afficher l'historique
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

  // Aucune enchère du tout → message vide
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enchères</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-8">
          Aucune phase active pour le moment
        </p>
      </CardContent>
    </Card>
  );
};
