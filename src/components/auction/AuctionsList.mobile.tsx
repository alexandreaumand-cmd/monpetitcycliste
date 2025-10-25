import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy } from "lucide-react";
import { AuctionPage } from "./AuctionPage";
import { AuctionPageV2 } from "./v2/AuctionPageV2";
import { MobileEmptyState } from "@/components/mobile";

interface AuctionsListProps {
  managerId: string;
}

export const AuctionsListMobile = ({ managerId }: AuctionsListProps) => {
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
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activePhases || activePhases.length === 0) {
    return (
      <MobileEmptyState
        icon={<Trophy className="h-16 w-16" />}
        title="Aucune enchère active"
        description="Aucune phase d'enchères n'est ouverte pour le moment"
      />
    );
  }

  // Always use V2
  return <AuctionPageV2 phaseId={activePhases[0].id} managerId={managerId} />;
};
