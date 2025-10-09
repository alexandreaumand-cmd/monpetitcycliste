import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useManagerSponsor = (managerId: string | undefined, saisonId: string | undefined) => {
  return useQuery<{ sponsor: string; jersey_image_url: string | null } | null>({
    queryKey: ['manager-sponsor', managerId, saisonId],
    queryFn: async () => {
      if (!managerId || !saisonId) return null;

      const { data, error } = await supabase
        .from('manager_sponsors')
        .select('sponsor, jersey_image_url')
        .eq('manager_id', managerId)
        .eq('saison_id', saisonId)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    },
    enabled: !!managerId && !!saisonId,
  });
};
