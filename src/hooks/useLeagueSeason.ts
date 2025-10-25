import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeagueSeason {
  seasonId: string;
  season: {
    id: string;
    annee: number;
  };
}

export function useLeagueSeason(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-season', leagueId],
    queryFn: async (): Promise<LeagueSeason | null> => {
      if (!leagueId) return null;

      const { data, error } = await supabase
        .from('leagues')
        .select('saison_id, saisons:saison_id(id, annee)')
        .eq('id', leagueId)
        .single();

      if (error) {
        console.error('[useLeagueSeason] Error fetching season:', error);
        throw error;
      }

      if (!data?.saison_id || !data.saisons) {
        return null;
      }

      return {
        seasonId: data.saison_id,
        season: data.saisons as { id: string; annee: number }
      };
    },
    enabled: !!leagueId,
  });
}
