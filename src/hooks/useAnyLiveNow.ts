import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveCourses } from "@/components/arena/LiveCourseSelector";
import { stageStateFromSchedule, parisDateKey } from "@/hooks/useLiveStageStatus";

const FRESH_MS = 30 * 60 * 1000;

/** Ticks every minute so the state follows the clock. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

interface StagePlanRow {
  course_id: string;
  stage_date: string;
  scrape_schedule: unknown;
}

/** Enabled stage plans for every live course (used to know if a stage runs today). */
function useStagePlans(courseIds: string[]) {
  const key = courseIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["live-stage-plans-any", key],
    queryFn: async () => {
      if (!courseIds.length) return [] as StagePlanRow[];
      const { data, error } = await supabase
        .from("live_stage_plans")
        .select("course_id, stage_date, scrape_schedule")
        .eq("is_enabled", true)
        .in("course_id", courseIds);
      if (error) throw error;
      return (data || []) as unknown as StagePlanRow[];
    },
    enabled: courseIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

/**
 * True when at least one active live course is really live right now.
 *
 * A course only counts when today (Paris time) is actually a race day:
 * - if the course has enabled stage plans, one of them must be dated today;
 * - otherwise today must fall between the course start and end dates.
 *
 * Then it is live when its situation was refreshed in the last 30 minutes or
 * the current Paris time falls inside one of today's scrape windows.
 */
export function useAnyLiveNow(): boolean {
  useMinuteTick();
  const { data: liveCourses } = useLiveCourses();
  const courseIds = (liveCourses || []).map((lc) => lc.course_id);
  const { data: plans } = useStagePlans(courseIds);

  if (!liveCourses?.length) return false;

  const today = parisDateKey();
  const now = Date.now();

  return liveCourses.some((lc) => {
    const coursePlans = (plans || []).filter((p) => p.course_id === lc.course_id);
    const todayPlan = coursePlans.find((p) => p.stage_date === today);

    if (coursePlans.length > 0) {
      // Planned stage race: only a stage scheduled today can be live.
      if (!todayPlan) return false;
    } else {
      const start = lc.courses?.date_debut ?? null;
      const end = lc.courses?.date_fin ?? start;
      if (start && today < start) return false;
      if (end && today > end) return false;
    }

    const updatedAt = lc.situation_updated_at ? Date.parse(lc.situation_updated_at) : NaN;
    if (Number.isFinite(updatedAt) && now - updatedAt < FRESH_MS) return true;

    const planSchedule = todayPlan?.scrape_schedule;
    const schedule =
      Array.isArray(planSchedule) && planSchedule.length > 0 ? planSchedule : lc.scrape_schedule;
    if (Array.isArray(schedule) && schedule.length > 0) {
      return stageStateFromSchedule(schedule) === "live";
    }
    return false;
  });
}
