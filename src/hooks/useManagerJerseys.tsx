import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useManagerJerseys = (managerIds: string[], saisonId: string | undefined) => {
  return useQuery<Record<string, string | null>>({
    queryKey: ['manager-jerseys-batch', managerIds, saisonId],
    queryFn: async () => {
      if (!managerIds || managerIds.length === 0 || !saisonId) return {};

      const { data, error } = await supabase
        .from('manager_sponsors')
        .select('manager_id, jersey_image_url')
        .in('manager_id', managerIds)
        .eq('saison_id', saisonId);

      if (error) throw error;

      // Convert to Record<manager_id, jersey_url>
      const jerseyMap: Record<string, string | null> = {};
      data?.forEach((row) => {
        jerseyMap[row.manager_id] = row.jersey_image_url;
      });

      return jerseyMap;
    },
    enabled: !!saisonId && managerIds.length > 0,
  });
};
