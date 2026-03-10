import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";

/**
 * Hook to fetch global standings (all phases combined) for a league
 */
export function useGlobalStandings() {
  const { leagueId, isLoading: leagueLoading } = useLeague();

  return useQuery({
    queryKey: ["global-standings", leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      const { data, error } = await supabase
        .from("v_manager_standings_total")
        .select("*")
        .eq("league_id", leagueId)
        .order("total_points", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Enrich with manager names
      const managerIds = [...new Set(data.map((d) => d.manager_id))];
      const { data: managersData } = await supabase
        .from("managers")
        .select("id, nom")
        .in("id", managerIds);

      const managersMap = new Map(
        managersData?.map((m) => [m.id, m.nom]) || []
      );

      return (
        data?.map((d) => ({
          ...d,
          manager_nom: managersMap.get(d.manager_id) || "Unknown",
        })) || []
      );
    },
    enabled: !leagueLoading && !!leagueId,
  });
}
