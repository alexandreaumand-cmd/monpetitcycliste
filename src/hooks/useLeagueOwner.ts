import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeagueOwner(ownerManagerId: string | null) {
  return useQuery({
    queryKey: ['league-owner', ownerManagerId],
    queryFn: async () => {
      if (!ownerManagerId) return null;

      const { data, error } = await supabase
        .from('managers')
        .select('id, nom')
        .eq('id', ownerManagerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ownerManagerId,
  });
}
