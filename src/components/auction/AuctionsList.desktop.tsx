import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AuctionPage } from "./AuctionPage";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsList = ({ managerId }: AuctionsListProps) => {
  const { data: activePhases, isLoading } = useQuery({
    queryKey: ['my-active-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id')
        .eq('statut', 'active')
        .order('date_debut', { ascending: false })
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

  if (!activePhases || activePhases.length === 0) {
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

  // Show auction page for the active phase
  return <AuctionPage phaseId={activePhases[0].id} managerId={managerId} />;
};
