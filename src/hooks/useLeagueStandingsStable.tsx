import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type StandingRow = {
  manager_id: string;
  manager_nom: string;
  total_points: number;
  bonus_points: number;
  scoreurs_count: number;
  victories_count: number;
};

/**
 * Hook robuste pour récupérer le classement via la fonction backend
 * get-aggregated-leaderboard (contourne les problèmes RLS sur les vues)
 */
export function useLeagueStandingsStable(
  leagueId: string | null,
  seasonId: string | null,
  phaseId?: string | null
) {
  return useQuery({
    queryKey: ['standings-stable', leagueId, seasonId, phaseId],
    queryFn: async () => {
      if (!leagueId || !seasonId) return [];

      const { data, error } = await supabase.functions.invoke('get-aggregated-leaderboard', {
        body: {
          league_id: leagueId,
          saison_id: seasonId,
          phase_id: phaseId ?? null,
        },
      });

      if (error) throw error;

      const leaderboard = data?.leaderboard ?? [];
      
      // Normalize to match expected format
      return leaderboard.map((row: any) => ({
        manager_id: row.manager_id,
        manager_nom: row.manager_name,
        total_points: row.total_points ?? 0,
        bonus_points: 0, // Will be fetched separately if needed
        scoreurs_count: row.courses_count ?? 0,
        victories_count: row.victories_count ?? 0,
      })) as StandingRow[];
    },
    enabled: !!leagueId && !!seasonId,
  });
}
