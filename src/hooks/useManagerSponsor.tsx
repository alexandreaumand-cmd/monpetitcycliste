import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useManagerSponsor = (managerId: string | undefined, saisonId: string | undefined) => {
  return useQuery({
    queryKey: ['manager-sponsor', managerId, saisonId],
    queryFn: async () => {
      if (!managerId || !saisonId) return null;

      const { data, error } = await supabase
        .from('manager_sponsors')
        .select('sponsor')
        .eq('manager_id', managerId)
        .eq('saison_id', saisonId)
        .maybeSingle();

      if (error) throw error;
      return data?.sponsor || null;
    },
    enabled: !!managerId && !!saisonId,
  });
};
