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

      let league: { name: string; game_mode: string } | null = null;

      // Try direct query first
      try {
        const { data, error } = await supabase
          .from('leagues')
          .select('name, game_mode')
          .eq('id', leagueId)
          .single();

        if (!error && data) {
          league = data;
        }
      } catch (err) {
        console.warn('[useCurrentLeagueInfo] Direct league query failed, trying via membership');
      }

      // Fallback: Get league via membership
      if (!league) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: memberData } = await supabase
            .from('league_members')
            .select('leagues(id, name, game_mode)')
            .eq('league_id', leagueId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (memberData?.leagues) {
            league = memberData.leagues as any;
          }
        }
      }

      if (!league) {
        throw new Error('Unable to access league information');
      }

      // Try to get season (non-blocking)
      let seasonYear: number | null = null;
      try {
        const { data: scope } = await supabase
          .from('league_scopes')
          .select('season_id, saisons(annee)')
          .eq('league_id', leagueId)
          .maybeSingle();

        seasonYear = scope?.saisons?.annee || null;
      } catch (err) {
        console.warn('[useCurrentLeagueInfo] Season query failed, continuing without it');
      }

      // Find template
      const template = LEAGUE_TEMPLATES.find(t => t.id === league.game_mode);

      return {
        leagueName: league.name,
        gameMode: league.game_mode as GameMode,
        gameModeName: template?.name || league.game_mode,
        seasonYear,
      };
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
