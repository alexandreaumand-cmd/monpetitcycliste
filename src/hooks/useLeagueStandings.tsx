import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";

/**
 * Hook pour récupérer le classement d'une ligue par saison
 * Utilise la RPC optimisée get_league_standings_by_season (filtre côté DB).
 */
export function useLeagueStandingsBySeason(leagueId: string | null, seasonId: string | null) {
  const { isLoading: leagueLoading } = useLeague();

  return useQuery({
    queryKey: ['league-standings-season', leagueId, seasonId],
    queryFn: async () => {
      if (!leagueId || !seasonId) return [];

      const { data, error } = await supabase.rpc('get_league_standings_by_season', {
        p_league_id: leagueId,
        p_saison_id: seasonId,
      });

      if (error) throw error;
      return (data || []).sort(
        (a: any, b: any) => Number(b.total_points) - Number(a.total_points)
      );
    },
    enabled: !leagueLoading && !!leagueId && !!seasonId,
  });
}

/**
 * Hook pour récupérer le classement d'une ligue par phase
 * Utilise la RPC optimisée get_league_standings_by_phase (filtre côté DB).
 */
export function useLeagueStandingsByPhase(leagueId: string | null, phaseId: string | null) {
  const { isLoading: leagueLoading } = useLeague();

  return useQuery({
    queryKey: ['league-standings-phase', leagueId, phaseId],
    queryFn: async () => {
      if (!leagueId || !phaseId) return [];

      const { data, error } = await supabase.rpc('get_league_standings_by_phase', {
        p_league_id: leagueId,
        p_phase_id: phaseId,
      });

      if (error) throw error;
      return (data || []).sort(
        (a: any, b: any) => Number(b.total_points) - Number(a.total_points)
      );
    },
    enabled: !leagueLoading && !!leagueId && !!phaseId,
  });
}
