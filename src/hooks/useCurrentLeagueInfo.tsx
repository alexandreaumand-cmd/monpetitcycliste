import { useQuery } from "@tanstack/react-query";
import { useLeague } from "@/contexts/LeagueContext";
import { supabase } from "@/integrations/supabase/client";
import { LEAGUE_TEMPLATES } from "@/lib/leagues/templates";
import type { GameMode } from "@/lib/leagues/types";

export function useCurrentLeagueInfo() {
  const { leagueId } = useLeague();

  return useQuery({
    queryKey: ['current-league-info', leagueId],
    queryFn: async () => {
      if (!leagueId) return null;

      // Récupérer les infos de la ligue
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('name, game_mode')
        .eq('id', leagueId)
        .single();

      if (leagueError) throw leagueError;

      // Récupérer la saison associée (tolérant si absente)
      const { data: scope } = await supabase
        .from('league_scopes')
        .select('season_id')
        .eq('league_id', leagueId)
        .maybeSingle();

      // Récupérer l'année de la saison si un scope existe
      let seasonYear: number | null = null;
      if (scope?.season_id) {
        const { data: seasonData } = await supabase
          .from('saisons')
          .select('annee')
          .eq('id', scope.season_id)
          .maybeSingle();
        
        seasonYear = seasonData?.annee ?? null;
      }

      // Trouver le template correspondant au mode de jeu
      const template = LEAGUE_TEMPLATES.find(t => t.id === league.game_mode);

      return {
        leagueName: league.name,
        gameMode: league.game_mode as GameMode,
        gameModeName: template?.name || league.game_mode,
        seasonYear,
      };
    },
    enabled: !!leagueId,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
