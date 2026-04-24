import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuctionCourse {
  id: string;
  nom: string;
  date_debut: string | null;
}

/**
 * Returns the list of courses for which a startlist has been imported,
 * scoped to the auction phase's season and (optionally) to the league
 * scope `selected_course_ids`.
 */
export function useAuctionAvailableCourses(
  phaseId: string | null | undefined,
  leagueId: string | null | undefined
) {
  return useQuery({
    queryKey: ["auction-available-courses", phaseId, leagueId],
    enabled: !!phaseId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AuctionCourse[]> => {
      // 1. Phase -> saison_id
      const { data: phase, error: phaseErr } = await supabase
        .from("phases")
        .select("saison_id")
        .eq("id", phaseId!)
        .single();
      if (phaseErr || !phase) return [];

      // 2. Optional league scope (selected_course_ids)
      let scopedCourseIds: string[] | null = null;
      if (leagueId) {
        const { data: scope } = await supabase
          .from("league_scopes")
          .select("selected_course_ids")
          .eq("league_id", leagueId)
          .maybeSingle();
        const ids = (scope?.selected_course_ids as string[] | null) || null;
        if (ids && ids.length > 0) scopedCourseIds = ids;
      }

      // 3. Distinct race_id from startlist_imports (saison-scoped)
      let importsQuery = supabase
        .from("startlist_imports")
        .select("race_id")
        .eq("saison_id", phase.saison_id);
      if (scopedCourseIds) {
        importsQuery = importsQuery.in("race_id", scopedCourseIds);
      }
      const { data: imports, error: importsErr } = await importsQuery;
      if (importsErr || !imports) return [];

      const raceIds = [...new Set(imports.map((i: any) => i.race_id).filter(Boolean))];
      if (raceIds.length === 0) return [];

      // 4. Join courses
      const { data: courses, error: coursesErr } = await supabase
        .from("courses")
        .select("id, nom, date_debut")
        .in("id", raceIds);
      if (coursesErr || !courses) return [];

      return [...courses].sort((a, b) => {
        const da = a.date_debut || "";
        const db = b.date_debut || "";
        return da.localeCompare(db);
      });
    },
  });
}
