import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLuckRanking = (saisonId: string, leagueId: string | null) => {
  return useQuery({
    queryKey: ["luck-ranking", saisonId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-luck-ranking', {
        body: { saison_id: saisonId, league_id: leagueId }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!saisonId && !!leagueId,
    staleTime: 1000 * 60 * 5,
  });
};
