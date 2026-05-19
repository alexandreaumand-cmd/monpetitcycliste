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
  // PCS latest-injuries is a flat table:
  // <td>YYYY-MM-DD</td><td>... <a href="rider/SLUG">NAME</a> ...</td><td>INJURY</td><td>WEEKS</td>
  const rowRegex =
    /<td[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/td>\s*<td[^>]*>[\s\S]*?<a[^>]*href="\/?rider\/([a-z0-9\-]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>/gi;

  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(html)) !== null) {
    const injury_date = m[1];
    const slug = m[2];
    const rawName = stripHtml(m[3]);
    const injury = stripHtml(m[4]);
    const weeks_out = parseInt(m[5], 10);
    if (!rawName || !injury || !Number.isFinite(weeks_out)) continue;
    results.push({
      rider_name_pcs: rawName,
      rider_slug: slug,
      injury_context: "",
      injury,
      injury_date,
      weeks_out,
    });
  }
  console.log(
    `[injuries] parse: html=${html.length}b rows=${results.length} sample=${results
      .slice(0, 3)
      .map((r) => `${r.rider_name_pcs} (${r.injury})`)
      .join(" | ")}`,
  );
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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
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
    const skipped_details: Array<{
      name: string;
      slug: string | null;
      injury: string;
      injury_date: string;
      weeks_out: number;
      reason: string;
    }> = [];
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    for (const inj of parsed) {
      // Skip injuries already finished (return date in the past)
      const returnDate = new Date(inj.injury_date);
      returnDate.setDate(returnDate.getDate() + inj.weeks_out * 7);
      const returnIso = returnDate.toISOString().slice(0, 10);
      if (returnIso < today) {
        skipped_details.push({
          name: inj.rider_name_pcs,
          slug: inj.rider_slug,
          injury: inj.injury,
          injury_date: inj.injury_date,
          weeks_out: inj.weeks_out,
          reason: "Convalescence terminée",
        });
        continue;
      }

      const norm = reformatPcsName(inj.rider_name_pcs);
      let coureurId = byNorm.get(norm);

      if (!coureurId) {
        const parts = norm.split(" ");
        const surname = parts[parts.length - 1];
        const candidates = bySurname.get(surname) ?? [];
        if (candidates.length === 1) coureurId = candidates[0];
      }

      if (!coureurId) {
        skipped_details.push({
          name: inj.rider_name_pcs,
          slug: inj.rider_slug,
          injury: inj.injury,
          injury_date: inj.injury_date,
          weeks_out: inj.weeks_out,
          reason: "Coureur introuvable dans la base",
        });
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
        skipped_count: skipped_details.length,
        skipped_details,
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
