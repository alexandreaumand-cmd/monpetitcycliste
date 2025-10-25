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

      // Étape 1: Récupérer season_id depuis league_scopes
      const { data: scopeData, error: scopeError } = await supabase
        .from('league_scopes')
        .select('season_id')
        .eq('league_id', leagueId)
        .maybeSingle();

      if (scopeError) {
        console.error('[useLeagueSeason] Error fetching league_scopes:', scopeError);
        throw scopeError;
      }

      if (!scopeData?.season_id) {
        console.warn('[useLeagueSeason] No season_id found for league:', leagueId);
        return null;
      }

      // Étape 2: Récupérer les détails de la saison
      const { data: seasonData, error: seasonError } = await supabase
        .from('saisons')
        .select('id, annee')
        .eq('id', scopeData.season_id)
        .single();

      if (seasonError) {
        console.error('[useLeagueSeason] Error fetching season:', seasonError);
        throw seasonError;
      }

      return {
        seasonId: seasonData.id,
        season: {
          id: seasonData.id,
          annee: seasonData.annee
        }
      };
    },
    enabled: !!leagueId,
  });
}
