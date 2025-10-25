import { useQuery } from "@tanstack/react-query";
import { useLeague } from "@/contexts/LeagueContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { supabase } from "@/integrations/supabase/client";
import { LEAGUE_TEMPLATES } from "@/lib/leagues/templates";
import type { GameMode } from "@/lib/leagues/types";

export function useCurrentLeagueInfo() {
  const { leagueId } = useLeague();
  const { selectedSeason } = useSeasonContext();

  return useQuery({
    queryKey: ['current-league-info', leagueId, selectedSeason?.id],
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

      // Déterminer l'année de saison avec fallback sur SeasonContext
      let seasonYear: number | null = selectedSeason?.annee ?? null;

      if (scope?.season_id && (!selectedSeason || selectedSeason.id !== scope.season_id)) {
        const { data: seasonRow } = await supabase
          .from('saisons')
          .select('annee')
          .eq('id', scope.season_id)
          .maybeSingle();
        seasonYear = seasonRow?.annee ?? seasonYear;
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
