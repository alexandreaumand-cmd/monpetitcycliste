import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AuctionBidForm } from "./AuctionBidForm";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsList = ({ managerId }: AuctionsListProps) => {
  const { data: activeAuctions, isLoading } = useQuery({
    queryKey: ['my-active-auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('statut', 'open')
        .order('created_at', { ascending: false });
      
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
            Aucune enchère en cours pour le moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activeAuctions.map((auction) => (
        <AuctionBidForm
          key={auction.id}
          auction={auction}
          managerId={managerId}
        />
      ))}
    </div>
  );
};
