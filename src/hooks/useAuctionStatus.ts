import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAuctionStatus = () => {
  const { data: phases, isLoading: loadingPhases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*, saisons(annee)')
        .eq('statut', 'active')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: activeAuctions } = useQuery({
    queryKey: ['active-auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select(`*, phases(index_dans_saison, saisons(annee))`)
        .eq('statut', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: closedAuctions } = useQuery({
    queryKey: ['closed-auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select(`*, phases(index_dans_saison, saisons(annee))`)
        .eq('statut', 'closed')
        .order('closed_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  const activePhase = phases?.[0];
  const nextRoundNumber = (activeAuctions?.filter(a => a.phase_id === activePhase?.id).length || 0) + 1;

  return {
    phases,
    loadingPhases,
    activeAuctions,
    closedAuctions,
    activePhase,
    nextRoundNumber,
  };
};
