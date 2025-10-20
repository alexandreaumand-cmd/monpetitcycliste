import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook pour récupérer le classement d'une ligue par saison
 */
export function useLeagueStandingsBySeason(leagueId: string | null, seasonId: string | null) {
  return useQuery({
    queryKey: ['league-standings-season', leagueId, seasonId],
    queryFn: async () => {
      if (!leagueId || !seasonId) return [];

      const { data, error } = await supabase
        .from('v_manager_standings_by_season_v2')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_id', seasonId)
        .order('total_points', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!leagueId && !!seasonId,
  });
}

/**
 * Hook pour récupérer le classement d'une ligue par phase
 */
export function useLeagueStandingsByPhase(leagueId: string | null, phaseId: string | null) {
  return useQuery({
    queryKey: ['league-standings-phase', leagueId, phaseId],
    queryFn: async () => {
      if (!leagueId || !phaseId) return [];

      const { data, error } = await supabase
        .from('v_manager_standings_by_phase_v2')
        .select('*')
        .eq('league_id', leagueId)
        .eq('phase_id', phaseId)
        .order('total_points', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!leagueId && !!phaseId,
  });
}
