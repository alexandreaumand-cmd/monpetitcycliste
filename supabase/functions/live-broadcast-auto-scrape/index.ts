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

type TimelineEvent = {
  time?: string;
  type?: string;
  title?: string;
  text?: string;
  riders?: string[];
};

type RaceSituation = {
  groups?: Array<{
    name?: string;
    gap?: string;
    riders?: string[];
    riderIds?: string[];
    riderCount?: number;
    isPeloton?: boolean;
    riderBibs?: string[];
    riderGcGaps?: string[];
  }>;
  kmRemaining?: number;
};

const PARIS_TZ = "Europe/Paris";

// Schedules are entered by admins in Paris local time; evaluate them in that zone
// (handles DST automatically) instead of the server's UTC clock.
function getParisMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function formatParisTime(now: Date): string {
  const m = getParisMinutes(now);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function getActiveInterval(schedule: ScrapeWindow[] | null, now: Date): number | null {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  const minutes = getParisMinutes(now);
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

function cleanText(text: string): string {
  return text
    .replace(/;/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

function buildSituationKey(situation: RaceSituation | null | undefined): string {
  if (!situation?.groups?.length) return "";
  return JSON.stringify(
    situation.groups.map((g) => `${g.name || ""}|${g.gap || ""}|${g.riderCount || g.riders?.length || 0}|${(g.riders || []).join(",")}`)
  ) + `|${Number(situation.kmRemaining || 0)}`;
}

function buildRiderMentions(situation: RaceSituation | null | undefined) {
  if (!situation?.groups?.length) return [] as Array<{ rider_nom: string; coureur_id: string }>;
  const mentions: Array<{ rider_nom: string; coureur_id: string }> = [];
  for (const group of situation.groups) {
    (group.riders || []).forEach((name, idx) => {
      const riderId = group.riderIds?.[idx];
      if (riderId) mentions.push({ rider_nom: name, coureur_id: riderId });
    });
  }
  return mentions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET") ?? Deno.env.get("LIVE_BROADCAST_CRON_SECRET");
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

  const [{ data: liveChannels, error: channelsError }, { data: activeLeagues, error: leaguesError }] = await Promise.all([
    admin.from("arena_channels").select("id, league_id").eq("slug", "live-courses"),
    admin.from("leagues").select("id").eq("status", "active"),
  ]);

  if (channelsError || leaguesError) {
    const message = channelsError?.message || leaguesError?.message || "Failed to load live broadcast channels";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const activeLeagueIds = new Set((activeLeagues || []).map((league: any) => league.id));
  const broadcastChannels = (liveChannels || []).filter((channel: any) => activeLeagueIds.has(channel.league_id));

  const { data: rows, error } = await admin
    .from("arena_live_courses")
    .select("course_id, live_scrape_url, scrape_schedule, last_auto_scrape_at, activated_by, current_etape, courses(type_course, date_debut, date_fin)")
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
          "x-cron-secret": expected,
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

      const data = await resp.json();
      if (data?.error) {
        throw new Error(data.error);
      }

      const latestStage = row.current_etape ?? null;
      const { data: recentMessages } = await admin
        .from("arena_messages")
        .select("content, metadata, created_at")
        .eq("course_id", row.course_id)
        .eq("message_type", "admin_broadcast")
        .order("created_at", { ascending: false })
        .limit(40);

      const latestSituationMessage = (recentMessages || []).find((message: any) => {
        const stage = message?.metadata?.etape_numero;
        const sit = message?.metadata?.race_situation;
        if (!sit) return false;
        return latestStage == null || stage == null || stage === latestStage;
      }) as any;

      const newSituation = (data?.situation || null) as RaceSituation | null;
      const newSituationKey = buildSituationKey(newSituation);
      const lastSituationKey = buildSituationKey(latestSituationMessage?.metadata?.race_situation as RaceSituation | undefined);

      if (newSituationKey && newSituationKey !== lastSituationKey && row.activated_by && broadcastChannels.length > 0) {
        const content = `🏁 Situation à ${Number(newSituation?.kmRemaining || 0)} km de l'arrivée`;
        const metadata = {
          race_situation: newSituation,
          rider_mentions: buildRiderMentions(newSituation),
          ...(latestStage != null ? { etape_numero: latestStage } : {}),
        };
        const batchId = crypto.randomUUID();
        const inserts = broadcastChannels.map((channel: any) => ({
          channel_id: channel.id,
          league_id: channel.league_id,
          author_manager_id: row.activated_by,
          message_type: "admin_broadcast",
          content,
          metadata,
          course_id: row.course_id,
          source_message_id: batchId,
        }));
        const { error: insertError } = await admin.from("arena_messages").insert(inserts);
        if (insertError) {
          throw new Error(`broadcast situation failed: ${insertError.message}`);
        }
        console.log(`[auto-scrape] Broadcasted new situation for ${row.course_id}`);
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
