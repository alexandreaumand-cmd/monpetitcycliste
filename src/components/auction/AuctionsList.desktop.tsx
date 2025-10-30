import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AuctionPage } from "./AuctionPage";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
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

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!activeAuctions || activeAuctions.length === 0) {
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
  }

  // Always use V2
  return <AuctionPageV2 phaseId={activeAuctions[0].phase_id} managerId={managerId} leagueId={leagueId} />;
};
