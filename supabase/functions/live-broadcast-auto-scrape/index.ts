// Cron-triggered: scans active live-broadcast courses with auto-scrape enabled,
// invokes scrape-live-race for each one whose schedule window is due.
// Protected by x-cron-secret header.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type ScrapeWindow = { start: string; end: string; intervalSec: number };

function getActiveInterval(schedule: ScrapeWindow[] | null, now: Date): number | null {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  for (const w of schedule) {
    const start = toMin(w.start);
    const end = toMin(w.end);
    if (start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end) {
      return w.intervalSec;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("LIVE_BROADCAST_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rows, error } = await admin
    .from("arena_live_courses")
    .select("course_id, live_scrape_url, scrape_schedule, last_auto_scrape_at, courses(type_course, date_debut, date_fin)")
    .eq("is_active", true)
    .eq("auto_scrape_enabled", true)
    .not("live_scrape_url", "is", null);

  if (error) {
    console.error("[auto-scrape] select error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ran: 0, skipped: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  let ran = 0;
  let skipped = 0;
  const errors: Array<{ course_id: string; error: string }> = [];

  for (const row of rows as any[]) {
    const interval = getActiveInterval(row.scrape_schedule as ScrapeWindow[] | null, now);
    if (interval == null) {
      // Out of window — clear next time
      await admin
        .from("arena_live_courses")
        .update({ next_auto_scrape_at: null })
        .eq("course_id", row.course_id)
        .eq("is_active", true);
      skipped++;
      continue;
    }
    const last = row.last_auto_scrape_at ? new Date(row.last_auto_scrape_at).getTime() : 0;
    const elapsed = (now.getTime() - last) / 1000;
    if (elapsed < interval) {
      skipped++;
      continue;
    }

    const isStageRace =
      row.courses?.type_course === "stage_race" ||
      (row.courses?.date_debut && row.courses?.date_fin && row.courses.date_debut !== row.courses.date_fin);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/scrape-live-race`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          url: row.live_scrape_url,
          course_id: row.course_id,
          is_stage_race: !!isStageRace,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`scrape-live-race ${resp.status}: ${text.slice(0, 200)}`);
      }
      const nextAt = new Date(now.getTime() + interval * 1000).toISOString();
      await admin
        .from("arena_live_courses")
        .update({ last_auto_scrape_at: now.toISOString(), next_auto_scrape_at: nextAt })
        .eq("course_id", row.course_id)
        .eq("is_active", true);
      ran++;
    } catch (e: any) {
      console.error("[auto-scrape] error for", row.course_id, e);
      errors.push({ course_id: row.course_id, error: e?.message ?? String(e) });
    }
  }

  return new Response(JSON.stringify({ ran, skipped, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
