import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch league stats for the current user.
 * CRITICAL: seasonId is REQUIRED - no fallback to global season allowed.
 */
export function useMyLeagueStats(
  leagueId: string | null,
  seasonId: string | null
) {
  return useQuery({
    queryKey: ['my-league-stats', leagueId, seasonId],
    queryFn: async () => {
      if (!leagueId || !seasonId) return null;

      // Get current user's manager
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return null;

      // Get season standings
      const { data: seasonStandings } = await supabase
        .from('v_manager_standings_by_season_v2')
        .select('*')
        .eq('league_id', leagueId)
        .eq('saison_id', seasonId)
        .order('total_points', { ascending: false });

      let mySeasonRank = null;
      let mySeasonPoints = null;
      let seasonLeader = null;

      if (seasonStandings) {
        const myIndex = seasonStandings.findIndex(s => s.manager_id === manager.id);
        if (myIndex >= 0) {
          mySeasonRank = myIndex + 1;
          mySeasonPoints = seasonStandings[myIndex].total_points;
        }
        if (seasonStandings.length > 0) {
          seasonLeader = {
            name: seasonStandings[0].manager_nom,
            points: seasonStandings[0].total_points,
          };
        }
      }

      return {
        mySeasonRank,
        mySeasonPoints,
        myPhaseRank: null,
        myPhasePoints: null,
        seasonLeader,
      };
    },
    enabled: !!leagueId && !!seasonId,
  });
}
