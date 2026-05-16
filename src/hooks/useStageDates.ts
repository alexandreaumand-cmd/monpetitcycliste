import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UseStageDatesResult {
  isLoading: boolean;
  /** Set of stage dates (yyyy-MM-dd) for a given course id; empty Set if none configured */
  getStageDates: (courseId: string) => Set<string>;
  /** True if the date falls inside [dateDebut, dateFin] of the course but is not a configured stage date */
  isRestDay: (courseId: string, dayIso: string, dateDebut?: string | null, dateFin?: string | null) => boolean;
  /** Number of rest days for a course (0 if none configured) */
  restDayCount: (courseId: string, dateDebut?: string | null, dateFin?: string | null) => number;
}

function eachDayIso(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

export function useStageDates(courseIds: string[]): UseStageDatesResult {
  const uniqIds = useMemo(() => Array.from(new Set(courseIds.filter(Boolean))).sort(), [courseIds]);

  const { data, isLoading } = useQuery({
    queryKey: ["stage-dates", uniqIds.join(",")],
    enabled: uniqIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_stage_config")
        .select("course_id, stage_date")
        .in("course_id", uniqIds)
        .not("stage_date", "is", null);
      if (error) throw error;
      const map = new Map<string, Set<string>>();
      (data || []).forEach((r: any) => {
        if (!r.stage_date) return;
        const set = map.get(r.course_id) || new Set<string>();
        set.add(r.stage_date as string);
        map.set(r.course_id, set);
      });
      return map;
    },
    staleTime: 60_000,
  });

  return useMemo<UseStageDatesResult>(() => {
    const empty = new Set<string>();
    const getStageDates = (courseId: string) => data?.get(courseId) || empty;
    const isRestDay = (
      courseId: string,
      dayIso: string,
      dateDebut?: string | null,
      dateFin?: string | null,
    ) => {
      const set = data?.get(courseId);
      if (!set || set.size === 0) return false;
      if (!dateDebut || !dateFin) return false;
      if (dayIso < dateDebut || dayIso > dateFin) return false;
      return !set.has(dayIso);
    };
    const restDayCount = (courseId: string, dateDebut?: string | null, dateFin?: string | null) => {
      const set = data?.get(courseId);
      if (!set || set.size === 0 || !dateDebut || !dateFin) return 0;
      return eachDayIso(dateDebut, dateFin).filter((d) => !set.has(d)).length;
    };
    return { isLoading, getStageDates, isRestDay, restDayCount };
  }, [data, isLoading]);
}
