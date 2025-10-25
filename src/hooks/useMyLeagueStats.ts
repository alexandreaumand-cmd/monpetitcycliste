import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";

export function useMyLeagueStats(leagueId: string | null) {
  const { season, activePhase } = useLeagueSeason();
  
  return useQuery({
    queryKey: ['my-league-stats', leagueId, season?.id, activePhase?.id],
    queryFn: async () => {
      if (!leagueId) return null;

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
      let mySeasonRank = null;
      let mySeasonPoints = null;
      let seasonLeader = null;
      
      if (season?.id) {
        const { data: seasonStandings } = await supabase
          .from('v_manager_standings_by_season_v2')
          .select('*, managers!inner(nom)')
          .eq('league_id', leagueId)
          .eq('saison_id', season.id)
          .order('total_points', { ascending: false });

        if (seasonStandings) {
          const myIndex = seasonStandings.findIndex(s => s.manager_id === manager.id);
          if (myIndex >= 0) {
            mySeasonRank = myIndex + 1;
            mySeasonPoints = seasonStandings[myIndex].total_points;
          }
          if (seasonStandings.length > 0 && seasonStandings[0].managers) {
            seasonLeader = {
              name: (seasonStandings[0].managers as any).nom,
              points: seasonStandings[0].total_points,
            };
          }
        }
      }

      // Get phase standings
      let myPhaseRank = null;
      let myPhasePoints = null;
      
      if (activePhase?.id) {
        const { data: phaseStandings } = await supabase
          .from('v_manager_standings_by_phase_v2')
          .select('*')
          .eq('league_id', leagueId)
          .eq('phase_id', activePhase.id)
          .order('total_points', { ascending: false });

        if (phaseStandings) {
          const myIndex = phaseStandings.findIndex(s => s.manager_id === manager.id);
          if (myIndex >= 0) {
            myPhaseRank = myIndex + 1;
            myPhasePoints = phaseStandings[myIndex].total_points;
          }
        }
      }

      return {
        mySeasonRank,
        mySeasonPoints,
        myPhaseRank,
        myPhasePoints,
        seasonLeader,
      };
    },
    enabled: !!leagueId && (!!season || !!activePhase),
  });
}
