import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches selected_course_ids for a league and filters race data accordingly.
 * Returns filtered races_by_rider where only league-scoped courses appear.
 */
export function useLeagueFilteredRaces(
  leagueId: string | null,
  riderRacesData: { races_by_rider: Record<string, { current_races: any[]; upcoming_races: any[] }> } | undefined
) {
  const { data: leagueSelectedCourseIds } = useQuery({
    queryKey: ["league-scope-courses", leagueId],
    queryFn: async () => {
      const { data } = await supabase
        .from("league_scopes")
        .select("selected_course_ids")
        .eq("league_id", leagueId!)
        .single();
      const ids = data?.selected_course_ids as string[] | null;
      return ids?.length ? ids : null;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });

  const filteredRacesData = useMemo(() => {
    if (!riderRacesData || !leagueSelectedCourseIds) return riderRacesData;

    const courseSet = new Set(leagueSelectedCourseIds);
    const filtered: Record<string, { current_races: any[]; upcoming_races: any[] }> = {};

    for (const [riderId, races] of Object.entries(riderRacesData.races_by_rider)) {
      filtered[riderId] = {
        current_races: races.current_races.filter((r: any) => courseSet.has(r.race_id)),
        upcoming_races: races.upcoming_races.filter((r: any) => courseSet.has(r.race_id)),
      };
    }

    return { races_by_rider: filtered };
  }, [riderRacesData, leagueSelectedCourseIds]);

  return filteredRacesData;
}
