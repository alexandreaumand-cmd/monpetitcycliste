import { useEffect, useState } from "react";
import { useLiveCourses } from "@/components/arena/LiveCourseSelector";
import { stageStateFromSchedule } from "@/hooks/useLiveStageStatus";

const FRESH_MS = 30 * 60 * 1000;

/** Ticks every minute so the state follows the clock. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

/**
 * True when at least one active live course is really live right now:
 * either its situation was updated in the last 30 minutes, or the current
 * Paris time falls inside one of its scrape windows.
 */
export function useAnyLiveNow(): boolean {
  useMinuteTick();
  const { data: liveCourses } = useLiveCourses();

  if (!liveCourses?.length) return false;

  const now = Date.now();
  return liveCourses.some((lc) => {
    const updatedAt = lc.situation_updated_at ? Date.parse(lc.situation_updated_at) : NaN;
    if (Number.isFinite(updatedAt) && now - updatedAt < FRESH_MS) return true;
    const schedule = lc.scrape_schedule;
    if (Array.isArray(schedule) && schedule.length > 0) {
      return stageStateFromSchedule(schedule) === "live";
    }
    return false;
  });
}
