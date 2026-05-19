import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const PCS_URL = "https://www.procyclingstats.com/statistics/start/latest-injuries";

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reformat PCS "LASTNAME Firstname Other" to "firstname lastname other".
 * In PCS, the surname is the leading ALL-CAPS tokens.
 */
function reformatPcsName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ");
  const surnameTokens: string[] = [];
  const restTokens: string[] = [];
  let inSurname = true;
  for (const t of tokens) {
    if (inSurname && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t)) {
      surnameTokens.push(t);
    } else {
      inSurname = false;
      restTokens.push(t);
    }
  }
  return normalizeName([...restTokens, ...surnameTokens].join(" "));
}

type ParsedInjury = {
  rider_name_pcs: string;
  rider_slug: string | null;
  injury_context: string;
  injury: string;
  injury_date: string;
  weeks_out: number;
};

function parseInjuries(html: string): ParsedInjury[] {
  const results: ParsedInjury[] = [];
  // Each rider block contains a /rider/<slug> link. Use it as a splitter.
  const blockRegex =
    /<a[^>]*href="\/rider\/([a-z0-9\-]+)"[^>]*>([^<]+)<\/a>([\s\S]*?)(?=<a[^>]*href="\/rider\/|$)/gi;

  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    const slug = m[1];
    const rawName = stripHtml(m[2]);
    const tail = m[3];

    // Skip thumbnail image-only anchors: the visible name link contains uppercase letters and space
    if (!/[A-Z]/.test(rawName) || rawName.length < 3) continue;

    const injuryMatch = tail.match(/Injury:\s*<\/b>\s*([^<]+)</i) ||
      tail.match(/Injury:\s*([^<\n]+?)(?:<|\n)/i);
    const dateMatch = tail.match(/Date of injury:\s*<\/b>\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i) ||
      tail.match(/Date of injury:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    const weeksMatch = tail.match(/Estimated weeks out:\s*<\/b>\s*([0-9]+)/i) ||
      tail.match(/Estimated weeks out:\s*([0-9]+)/i);
    if (!injuryMatch || !dateMatch || !weeksMatch) continue;

    // Context: text between the </a> closing tag of the name and the first <b>Injury
    const contextMatch = tail.match(/^([\s\S]*?)(?=<b[^>]*>\s*Injury:)/i);
    const injury_context = contextMatch ? stripHtml(contextMatch[1]) : "";

    results.push({
      rider_name_pcs: rawName,
      rider_slug: slug,
      injury_context,
      injury: stripHtml(injuryMatch[1]),
      injury_date: dateMatch[1],
      weeks_out: parseInt(weeksMatch[1], 10),
    });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

    // Auth: either x-cron-secret, or a logged-in superadmin
    const cronHeader = req.headers.get("x-cron-secret");
    let authorized = false;
    if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) {
      authorized = true;
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await userClient.auth.getUser();
        if (userData?.user) {
          const { data: isAdmin } = await userClient.rpc("is_superadmin");
          if (isAdmin === true) authorized = true;
        }
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fetch PCS page
    const res = await fetch(PCS_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LaBordureBot/1.0; +https://labordure.app)",
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `PCS fetch failed: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const html = await res.text();
    const parsed = parseInjuries(html);

    // Load all riders for matching
    const { data: riders, error: ridersErr } = await admin
      .from("coureurs")
      .select("id, nom");
    if (ridersErr) throw ridersErr;

    const byNorm = new Map<string, string>(); // normalized name -> coureur_id
    const bySurname = new Map<string, string[]>(); // surname -> [coureur_ids]
    for (const r of riders ?? []) {
      const n = normalizeName(r.nom);
      byNorm.set(n, r.id);
      const parts = n.split(" ");
      const surname = parts[parts.length - 1];
      if (!bySurname.has(surname)) bySurname.set(surname, []);
      bySurname.get(surname)!.push(r.id);
    }

    let matched = 0;
    let upserted = 0;
    const skipped: string[] = [];
    const now = new Date().toISOString();

    for (const inj of parsed) {
      const norm = reformatPcsName(inj.rider_name_pcs);
      let coureurId = byNorm.get(norm);

      if (!coureurId) {
        // Try last word as surname
        const parts = norm.split(" ");
        const surname = parts[parts.length - 1];
        const candidates = bySurname.get(surname) ?? [];
        if (candidates.length === 1) coureurId = candidates[0];
      }

      if (!coureurId) {
        skipped.push(inj.rider_name_pcs);
        continue;
      }
      matched++;

      const { error: upErr } = await admin
        .from("rider_injuries")
        .upsert(
          {
            coureur_id: coureurId,
            rider_name_pcs: inj.rider_name_pcs,
            injury: inj.injury,
            injury_context: inj.injury_context,
            injury_date: inj.injury_date,
            weeks_out: inj.weeks_out,
            source_url: PCS_URL,
            last_seen_at: now,
          },
          { onConflict: "coureur_id,injury_date,injury" },
        );
      if (!upErr) upserted++;
      else console.error("upsert error", upErr, inj);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scraped: parsed.length,
        matched,
        upserted,
        skipped_count: skipped.length,
        skipped_sample: skipped.slice(0, 10),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
