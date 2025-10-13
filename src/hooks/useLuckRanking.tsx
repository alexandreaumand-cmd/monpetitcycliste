import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLuckRanking = (saisonId: string) => {
  return useQuery({
    queryKey: ["luck-ranking", saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-luck-ranking', {
        body: { saison_id: saisonId }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!saisonId,
    staleTime: 1000 * 60 * 5,
  });
};
