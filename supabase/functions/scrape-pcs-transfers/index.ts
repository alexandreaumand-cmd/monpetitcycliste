import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchPcs } from "../_shared/pcsFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const buildUrl = (days: number) =>
  `https://www.procyclingstats.com/teams.php?s=transfers&sekse=men&teamlevel=ct_and_up&nation=&days=${days}&filter=Filter`;

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
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** PCS shows "LASTNAME Firstname" -> normalized "firstname lastname". */
function reformatPcsName(raw: string): string {
  const tokens = raw.replace(/\s+/g, " ").trim().split(" ");
  const surname: string[] = [];
  const rest: string[] = [];
  let inSurname = true;
  for (const t of tokens) {
    if (inSurname && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t)) surname.push(t);
    else {
      inSurname = false;
      rest.push(t);
    }
  }
  return normalizeName([...rest, ...surname].join(" "));
}

type ParsedTransfer = {
  published_at: string | null;
  pcs_rider_name: string;
  pcs_rider_slug: string;
  from_team_name: string | null;
  from_team_slug: string | null;
  to_team_name: string;
  to_team_slug: string;
  target_year: number;
};

function parseTransfers(html: string): ParsedTransfer[] {
  const out: ParsedTransfer[] = [];
  // Isolate the first "basic" table (the transfers list)
  const tableMatch = html.match(/<table[^>]*class="[^"]*basic[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  const body = tableMatch ? tableMatch[1] : html;

  const rows = body.split(/<tr[^>]*>/i).slice(1);
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 5) continue;

    const published = stripHtml(cells[0]).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

    const riderCell = cells[1];
    const riderLink = riderCell.match(/href="\/?rider\/([a-z0-9\-]+)"/i);
    const riderName = stripHtml(riderCell);
    if (!riderName) continue;

    const fromCell = cells[2];
    const fromSlug = fromCell.match(/href="\/?team\/([a-z0-9\-]+)/i)?.[1] ?? null;
    const fromName = stripHtml(fromCell) || null;

    const toCell = cells[3];
    const toSlug = toCell.match(/href="\/?team\/([a-z0-9\-]+)/i)?.[1] ?? null;
    const toName = stripHtml(toCell);
    if (!toName) continue;

    const year = parseInt(stripHtml(cells[4]).match(/\d{4}/)?.[0] ?? "", 10);
    if (!Number.isFinite(year)) continue;

    out.push({
      published_at: published,
      pcs_rider_name: riderName,
      pcs_rider_slug: riderLink?.[1] ?? normalizeName(riderName).replace(/\s+/g, "-"),
      from_team_name: fromName,
      from_team_slug: fromSlug,
      to_team_name: toName,
      to_team_slug: toSlug ?? normalizeName(toName).replace(/\s+/g, "-"),
      target_year: year,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

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

    let days = 120;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const d = Number(body?.days);
      if (Number.isFinite(d) && d > 0 && d <= 400) days = Math.floor(d);
    }

    const url = buildUrl(days);
    const res = await fetchPcs(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `PCS fetch failed: ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const html = await res.text();
    const parsed = parseTransfers(html);
    console.log(`[transfers] parsed=${parsed.length} html=${html.length}b days=${days}`);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Reference data for auto-matching
    const [{ data: riders }, { data: aliases }, { data: saisons }, { data: teamSeasons }] =
      await Promise.all([
        admin.from("coureurs").select("id, nom"),
        admin.from("name_aliases").select("alias_text, coureur_id"),
        admin.from("saisons").select("id, annee"),
        admin.from("equipes_saisons").select("equipe_id, saison_id, nom_affiche"),
      ]);

    const byNorm = new Map<string, string>();
    const bySurname = new Map<string, string[]>();
    for (const r of riders ?? []) {
      const n = normalizeName(r.nom as string);
      byNorm.set(n, r.id as string);
      const parts = n.split(" ");
      const surname = parts[parts.length - 1];
      if (!bySurname.has(surname)) bySurname.set(surname, []);
      bySurname.get(surname)!.push(r.id as string);
    }
    for (const a of aliases ?? []) {
      const n = normalizeName(a.alias_text as string);
      if (!byNorm.has(n)) byNorm.set(n, a.coureur_id as string);
    }

    const saisonByYear = new Map<number, string>();
    for (const s of saisons ?? []) saisonByYear.set(s.annee as number, s.id as string);

    // team name (normalized) + saison_id -> equipe_id
    const teamByNameSeason = new Map<string, string>();
    for (const t of teamSeasons ?? []) {
      teamByNameSeason.set(
        `${t.saison_id}|${normalizeName((t.nom_affiche as string) ?? "")}`,
        t.equipe_id as string,
      );
    }

    let inserted = 0;
    let skipped = 0;

    for (const t of parsed) {
      const saisonId = saisonByYear.get(t.target_year) ?? null;

      const norm = reformatPcsName(t.pcs_rider_name);
      let coureurId = byNorm.get(norm) ?? null;
      if (!coureurId) {
        const parts = norm.split(" ");
        const candidates = bySurname.get(parts[parts.length - 1]) ?? [];
        if (candidates.length === 1) coureurId = candidates[0];
      }

      let equipeId: string | null = null;
      if (saisonId) {
        equipeId = teamByNameSeason.get(`${saisonId}|${normalizeName(t.to_team_name)}`) ?? null;
      }

      const { error } = await admin.from("rider_transfers").insert({
        published_at: t.published_at,
        pcs_rider_name: t.pcs_rider_name,
        pcs_rider_slug: t.pcs_rider_slug,
        from_team_name: t.from_team_name,
        from_team_slug: t.from_team_slug,
        to_team_name: t.to_team_name,
        to_team_slug: t.to_team_slug,
        target_year: t.target_year,
        saison_id: saisonId,
        coureur_id: coureurId,
        equipe_id: equipeId,
        statut: "nouveau",
      });

      if (error) {
        // 23505 = unique violation -> transfer already known
        if ((error as { code?: string }).code === "23505") skipped++;
        else console.error("insert error", error, t);
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, scraped: parsed.length, inserted, already_known: skipped, days }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[transfers] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
