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
// Copy the live situation into the arena timeline at most once every 30 minutes
const SITUATION_TIMELINE_INTERVAL_MS = 30 * 60 * 1000;

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

function getParisDate(now: Date): string {
  // YYYY-MM-DD in Paris timezone
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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

type LiveEvent = {
  uid: string;
  type: "pulling" | "position" | "back_of_peloton" | "crash" | "team_car" | "abandon" | "attack";
  rider_name: string;
  rider_nom?: string;
  team?: string;
  km_to_go?: number | null;
  position?: number;
  coureur_id?: string;
  manager_name?: string;
};

// Max new livetext events published per course per run, to avoid flooding the timeline
const MAX_LIVE_EVENTS_PER_RUN = 10;

function formatLiveEvent(ev: LiveEvent): string {
  const name = ev.rider_nom || ev.rider_name;
  // {Rider} mentions are rendered by the UI, which appends the league's manager name
  const rider = ev.coureur_id ? `{${name}}` : name;
  const km = typeof ev.km_to_go === "number" && ev.km_to_go > 0 ? ` — à ${ev.km_to_go} km` : "";
  switch (ev.type) {
    case "pulling":
      return `🔧 ${rider} fait le relais dans le peloton${km}`;
    case "position":
      return `#️⃣ ${rider} est en position ${ev.position ?? "?"}${km}`;
    case "back_of_peloton":
      return `⬇️ ${rider} est en queue de peloton${km}`;
    case "crash":
      return `⚠️ Chute de ${rider}${km}`;
    case "team_car":
      return `🚗 ${rider} est à la voiture d'équipe${km}`;
    case "abandon":
      return `❌ ${rider} abandonne${km}`;
    default:
      return `${rider}${km}`;
  }
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
    .eq("auto_scrape_enabled", true);

  if (error) {
    console.error("[auto-scrape] select error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const parisTime = formatParisTime(now);
  const parisDate = getParisDate(now);

  // Stage plans scheduled for today (Paris) — these override the course-level url/schedule
  const { data: todayPlans } = await admin
    .from("live_stage_plans")
    .select("id, course_id, etape_numero, scrape_url, scrape_schedule, last_auto_scrape_at")
    .eq("is_enabled", true)
    .eq("stage_date", parisDate);

  const planByCourse = new Map<string, any>();
  for (const plan of (todayPlans || []) as any[]) {
    if (plan.scrape_url) planByCourse.set(plan.course_id, plan);
  }

  if (!rows || rows.length === 0) {
    console.log(`[auto-scrape] ${parisTime} Paris — no active course with auto-scrape enabled`);
    return new Response(JSON.stringify({ ran: 0, skipped: 0, paris_time: parisTime }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ran = 0;
  let skipped = 0;
  const errors: Array<{ course_id: string; error: string }> = [];

  console.log(`[auto-scrape] ${parisTime} Paris — ${rows.length} course(s) with auto-scrape enabled`);

  for (const row of rows as any[]) {
    const plan = planByCourse.get(row.course_id) || null;
    const source = plan ? "plan" : "fallback";
    const effectiveUrl: string | null = plan?.scrape_url ?? row.live_scrape_url ?? null;
    const effectiveSchedule = (plan
      ? (Array.isArray(plan.scrape_schedule) && plan.scrape_schedule.length > 0
          ? plan.scrape_schedule
          : row.scrape_schedule)
      : row.scrape_schedule) as ScrapeWindow[] | null;
    const effectiveStage: number | null = plan?.etape_numero ?? row.current_etape ?? null;
    const lastAt = plan ? (plan.last_auto_scrape_at ?? row.last_auto_scrape_at) : row.last_auto_scrape_at;

    // Keep the course row aligned with today's plan even when we are outside the
    // scrape windows, so the UI never shows yesterday's stage as the live one.
    if (plan) {
      const patch: Record<string, unknown> = {};
      if (plan.scrape_url && plan.scrape_url !== row.live_scrape_url) {
        patch.live_scrape_url = plan.scrape_url;
      }
      if (plan.etape_numero != null && plan.etape_numero !== row.current_etape) {
        patch.current_etape = plan.etape_numero;
      }
      if (Object.keys(patch).length > 0) {
        await admin
          .from("arena_live_courses")
          .update(patch)
          .eq("course_id", row.course_id)
          .eq("is_active", true);
        console.log(
          `[auto-scrape] ${row.course_id}: aligned with today's plan (stage=${plan.etape_numero ?? "-"})`
        );
      }
    }

    if (!effectiveUrl) {
      console.log(`[auto-scrape] ${row.course_id}: no scrape url (source=${source}) — skipped`);
      skipped++;
      continue;
    }


    const interval = getActiveInterval(effectiveSchedule, now);
    if (interval == null) {
      console.log(`[auto-scrape] ${row.course_id}: out of schedule window at ${parisTime} Paris — skipped`);
      // Out of window — clear next time
      await admin
        .from("arena_live_courses")
        .update({ next_auto_scrape_at: null })
        .eq("course_id", row.course_id)
        .eq("is_active", true);
      if (plan) {
        await admin.from("live_stage_plans").update({ next_auto_scrape_at: null }).eq("id", plan.id);
      }
      skipped++;
      continue;
    }
    const last = lastAt ? new Date(lastAt).getTime() : 0;
    const elapsed = (now.getTime() - last) / 1000;
    if (elapsed < interval) {
      console.log(
        `[auto-scrape] ${row.course_id}: in window (every ${interval}s) but only ${Math.round(elapsed)}s elapsed — skipped`
      );
      skipped++;
      continue;
    }

    console.log(
      `[auto-scrape] ${row.course_id}: running (source=${source}, stage=${effectiveStage ?? "-"}, window interval ${interval}s, ${Math.round(elapsed)}s elapsed)`
    );


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
          url: effectiveUrl,
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

      const latestStage = effectiveStage;
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

      // Always keep the live "Situation" panel fresh (independent of the timeline)
      if (newSituationKey) {
        await admin
          .from("arena_live_courses")
          .update({
            current_race_situation: {
              ...(newSituation as any),
              ...(latestStage != null ? { etape_numero: latestStage } : {}),
            },
            situation_updated_at: now.toISOString(),
          })
          .eq("course_id", row.course_id)
          .eq("is_active", true);
      }

      // Copy the situation into the timeline at most every 30 minutes
      const lastTimelineCopyAt = latestSituationMessage?.created_at
        ? new Date(latestSituationMessage.created_at).getTime()
        : null;
      const timelineCopyDue =
        lastTimelineCopyAt == null || now.getTime() - lastTimelineCopyAt >= SITUATION_TIMELINE_INTERVAL_MS;

      if (
        newSituationKey &&
        newSituationKey !== lastSituationKey &&
        timelineCopyDue &&
        row.activated_by &&
        broadcastChannels.length > 0
      ) {
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

      // Publish new PCS livetext rider events (pulling, position, back of peloton,
      // crash, team car, abandon) into the arena timeline — once per event uid.
      const liveEvents = (Array.isArray(data?.live_events) ? data.live_events : []) as LiveEvent[];
      if (liveEvents.length > 0 && row.activated_by && broadcastChannels.length > 0) {
        const { data: publishedRows } = await admin
          .from("arena_messages")
          .select("metadata")
          .eq("course_id", row.course_id)
          .eq("message_type", "admin_broadcast")
          .not("metadata->>live_event_uid", "is", null)
          .order("created_at", { ascending: false })
          .limit(500);

        const publishedUids = new Set(
          (publishedRows || [])
            .map((m: any) => m?.metadata?.live_event_uid)
            .filter((uid: any) => typeof uid === "string")
        );

        const fresh = liveEvents
          .filter((ev) => ev?.uid && !publishedUids.has(ev.uid))
          .slice(-MAX_LIVE_EVENTS_PER_RUN);

        if (fresh.length > 0) {
          const inserts = fresh.flatMap((ev) => {
            const content = formatLiveEvent(ev);
            const metadata = {
              live_event_uid: ev.uid,
              live_event_type: ev.type,
              ...(latestStage != null ? { etape_numero: latestStage } : {}),
              rider_mentions: ev.coureur_id
                ? [{ rider_nom: ev.rider_nom || ev.rider_name, coureur_id: ev.coureur_id }]
                : [],
            };
            const batchId = crypto.randomUUID();
            return broadcastChannels.map((channel: any) => ({
              channel_id: channel.id,
              league_id: channel.league_id,
              author_manager_id: row.activated_by,
              message_type: "admin_broadcast",
              content,
              metadata,
              course_id: row.course_id,
              source_message_id: batchId,
            }));
          });

          const { error: eventsError } = await admin.from("arena_messages").insert(inserts);
          if (eventsError) {
            console.error(`[auto-scrape] livetext insert failed: ${eventsError.message}`);
          } else {
            console.log(`[auto-scrape] Published ${fresh.length} livetext event(s) for ${row.course_id}`);
          }
        }
      }



      const nextAt = new Date(now.getTime() + interval * 1000).toISOString();
      await admin
        .from("arena_live_courses")
        .update({ last_auto_scrape_at: now.toISOString(), next_auto_scrape_at: nextAt })
        .eq("course_id", row.course_id)
        .eq("is_active", true);
      if (plan) {
        await admin
          .from("live_stage_plans")
          .update({ last_auto_scrape_at: now.toISOString(), next_auto_scrape_at: nextAt })
          .eq("id", plan.id);
      }
      ran++;
    } catch (e: any) {
      console.error("[auto-scrape] error for", row.course_id, e);
      errors.push({ course_id: row.course_id, error: e?.message ?? String(e) });
    }
  }

  console.log(`[auto-scrape] ${parisTime} Paris — done: ran=${ran}, skipped=${skipped}, errors=${errors.length}`);

  return new Response(JSON.stringify({ ran, skipped, errors, paris_time: parisTime }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
