import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LiveStageState = "upcoming" | "live" | "finished";

export interface LiveStageStatus {
  /** Stage number to display (today's plan when available, else stored current_etape) */
  etape: number | null;
  state: LiveStageState;
}

interface ScrapeWindow {
  start: string;
  end: string;
  intervalSec?: number;
}

const PARIS_TZ = "Europe/Paris";

/** YYYY-MM-DD in Paris time */
export function parisDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Minutes since midnight, Paris time */
function parisMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function toMinutes(value: string): number {
  const [h, m] = String(value).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function normalizeWindows(schedule: unknown): ScrapeWindow[] {
  if (!Array.isArray(schedule)) return [];
  return schedule.filter(
    (w): w is ScrapeWindow =>
      !!w && typeof (w as any).start === "string" && typeof (w as any).end === "string"
  );
}

export function stageStateFromSchedule(schedule: unknown, now: Date = new Date()): LiveStageState {
  const windows = normalizeWindows(schedule);
  if (windows.length === 0) return "live"; // no schedule → keep legacy behaviour
  const minutes = parisMinutes(now);
  const starts = windows.map((w) => toMinutes(w.start));
  const ends = windows.map((w) => toMinutes(w.end));
  const inWindow = windows.some((w, i) => {
    const start = starts[i];
    const end = ends[i];
    return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  });
  if (inWindow) return "live";
  return minutes < Math.min(...starts) ? "upcoming" : "finished";
}

/** Ticks every minute so the badge state follows the clock. */
function useMinuteTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return tick;
}

/**
 * Resolves the stage that is actually scheduled today (Paris time) for a live
 * course, plus whether we are inside one of its scrape windows.
 */
export function useLiveStageStatus(
  courseId: string | null | undefined,
  fallbackEtape: number | null | undefined
): LiveStageStatus {
  useMinuteTick();
  const dateKey = parisDateKey();

  const { data } = useQuery({
    queryKey: ["live-stage-plan-today", courseId, dateKey],
    queryFn: async () => {
      const [planRes, courseRes] = await Promise.all([
        supabase
          .from("live_stage_plans")
          .select("etape_numero, scrape_schedule")
          .eq("course_id", courseId as string)
          .eq("is_enabled", true)
          .eq("stage_date", dateKey)
          .maybeSingle(),
        supabase
          .from("arena_live_courses")
          .select("scrape_schedule")
          .eq("course_id", courseId as string)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      return {
        plan: (planRes.data as any) ?? null,
        courseSchedule: (courseRes.data as any)?.scrape_schedule ?? null,
      };
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });

  const planEtape = data?.plan?.etape_numero ?? null;
  const planSchedule = normalizeWindows(data?.plan?.scrape_schedule);
  const schedule = planSchedule.length > 0 ? planSchedule : data?.courseSchedule ?? null;

  return {
    etape: planEtape ?? fallbackEtape ?? null,
    state: stageStateFromSchedule(schedule),
  };
}
