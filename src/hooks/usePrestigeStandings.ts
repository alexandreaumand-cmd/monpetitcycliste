import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PrestigeStanding {
  manager_id: string;
  manager_nom: string;
  avatar_url: string | null;
  total_points: number;
  pronostic_points: number;
  reaction_points: number;
}

export function usePrestigeStandings(leagueId: string) {
  return useQuery({
    queryKey: ["prestige-standings", leagueId],
    queryFn: async () => {
      // Get all prestige points for this league
      const { data: points, error } = await supabase
        .from("arena_prestige_points")
        .select("manager_id, points, source_type")
        .eq("league_id", leagueId);

      if (error) throw error;
      if (!points || points.length === 0) return [];

      // Aggregate by manager
      const byManager = new Map<string, { total: number; pronostic: number; reaction: number }>();
      for (const p of points) {
        const existing = byManager.get(p.manager_id) || { total: 0, pronostic: 0, reaction: 0 };
        existing.total += p.points;
        if (p.source_type === "pronostic") existing.pronostic += p.points;
        else if (p.source_type === "reaction_received") existing.reaction += p.points;
        byManager.set(p.manager_id, existing);
      }

      // Fetch manager info
      const managerIds = Array.from(byManager.keys());
      const { data: managers } = await supabase
        .from("managers")
        .select("id, nom, avatar_url")
        .in("id", managerIds);

      const managersMap = new Map((managers || []).map(m => [m.id, m]));

      const standings: PrestigeStanding[] = Array.from(byManager.entries()).map(([mid, agg]) => {
        const mgr = managersMap.get(mid);
        return {
          manager_id: mid,
          manager_nom: mgr?.nom || "?",
          avatar_url: mgr?.avatar_url || null,
          total_points: agg.total,
          pronostic_points: agg.pronostic,
          reaction_points: agg.reaction,
        };
      });

      standings.sort((a, b) => b.total_points - a.total_points);
      return standings;
    },
    enabled: !!leagueId,
    staleTime: 2 * 60 * 1000,
  });
}
