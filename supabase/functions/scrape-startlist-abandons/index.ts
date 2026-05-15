import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PCS_BASE = 'https://www.procyclingstats.com';

function normalize(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

interface ParsedRider {
  bib: string | null;
  name: string;
  abandon_type: 'DNF' | 'DNS';
  abandon_etape: number;
}

/**
 * Parse PCS startlist HTML for riders flagged with (DNF #N) or (DNS #N).
 * PCS rides table uses <li> per rider with bib + name. We work line-by-line on text.
 */
function parsePcsStartlist(html: string): ParsedRider[] {
  const out: ParsedRider[] = [];
  // Strip scripts/styles
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  // PCS marks abandoned riders with class="dropout" on the <li>. Target only those.
  // Use a lazy non-greedy match up to the next <li or </ul (rider lists are flat per team).
  const dropoutRegex = /<li[^>]*class="[^"]*\bdropout\b[^"]*"[^>]*>([\s\S]*?)(?=<li\b|<\/ul>)/gi;
  let m: RegExpExecArray | null;
  while ((m = dropoutRegex.exec(cleaned)) !== null) {
    const liContent = m[1];

    // Extract bib from <span class="bib">N</span>
    const bibMatch = liContent.match(/<span[^>]*class="[^"]*\bbib\b[^"]*"[^>]*>\s*(\d{1,4})\s*<\/span>/i);
    const bib = bibMatch ? bibMatch[1] : null;

    // Extract rider name from the rider <a href="rider/...">NAME</a>
    const nameMatch = liContent.match(/<a[^>]*href="[^"]*rider\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    let name = '';
    if (nameMatch) {
      name = nameMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      name = name.replace(/\*+$/, '').trim();
    }

    // Extract abandon flag from the trailing text (after </a>)
    const text = liContent.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const abandonMatch = text.match(/\((DNF|DNS|OTL|DSQ)\s*#?\s*(\d+)\)/i);
    if (!abandonMatch) continue;

    const rawType = abandonMatch[1].toUpperCase();
    const abandon_type: 'DNF' | 'DNS' = rawType === 'DNS' ? 'DNS' : 'DNF';
    const abandon_etape = parseInt(abandonMatch[2], 10);
    if (!Number.isFinite(abandon_etape)) continue;
    if (!name) continue;

    out.push({ bib, name, abandon_type, abandon_etape });
  }
  return out;
}

function buildStartlistUrl(race: { pcs_slug: string | null; year: number; file_url: string | null }): string | null {
  // Prefer pcs_slug (canonical) — file_url may contain stale archive slugs (e.g. "giro-d-italia-mj6wbnif")
  // or legacy underscore slugs (e.g. "tour_de_hongrie") that PCS no longer serves.
  if (race.pcs_slug) {
    return `${PCS_BASE}/race/${race.pcs_slug}/${race.year}/startlist`;
  }
  if (race.file_url && /procyclingstats\.com\/race\//i.test(race.file_url)) {
    let u = race.file_url.trim().replace(/\/+$/, '');
    // Strip known PCS sub-pages so we get back to /race/<slug>[/year]
    u = u.replace(/\/(startlist|overview|route|stages?|gc|results|today|preview|history|stage-\d+)(\/.*)?$/i, '');
    // Normalize underscores to hyphens (PCS canonical slug format)
    u = u.replace(/\/race\/([^/]+)/i, (_m, slug) => `/race/${slug.replace(/_/g, '-')}`);
    return `${u}/startlist`;
  }
  return null;
}

const PCS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function processRace(
  supabase: any,
  race: { id: string; nom: string; pcs_slug: string | null; year: number; startlist_id: string; file_url: string | null }
): Promise<{ race_id: string; nom: string; dnf: number; dns: number; matched: number; total_flagged: number; error?: string }> {
  try {
    const url = buildStartlistUrl(race);
    if (!url) {
      console.warn(`[abandons] No PCS URL for ${race.nom}`);
      return { race_id: race.id, nom: race.nom, dnf: 0, dns: 0, matched: 0, total_flagged: 0, error: 'no PCS URL' };
    }
    console.log(`[abandons] Fetching ${url}`);
    const res = await fetch(url, { headers: PCS_HEADERS });
    if (!res.ok) {
      console.warn(`[abandons] PCS HTTP ${res.status} for ${race.pcs_slug}`);
      return { race_id: race.id, nom: race.nom, dnf: 0, dns: 0, matched: 0, total_flagged: 0, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const flagged = parsePcsStartlist(html);
    console.log(`[abandons] ${race.nom}: ${flagged.length} flagged riders detected`);

    // Load startlist entries for this startlist
    const { data: entries, error: entriesError } = await supabase
      .from('startlist_entries')
      .select('id, bib_no, source_name, coureur_id, abandon_type, abandon_etape')
      .eq('startlist_id', race.startlist_id);
    if (entriesError) throw entriesError;

    // Build matching maps
    const byBib = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const e of entries || []) {
      if (e.bib_no) byBib.set(String(e.bib_no).trim(), e);
      byName.set(normalize(e.source_name), e);
    }

    const now = new Date().toISOString();
    let matched = 0;
    const updates: { id: string; abandon_type: string; abandon_etape: number }[] = [];

    for (const rider of flagged) {
      let entry = rider.bib ? byBib.get(rider.bib) : null;
      if (!entry) {
        // Try name matching (last name or full name)
        entry = byName.get(normalize(rider.name)) || null;
        if (!entry) {
          // Try matching by lastname-only (PCS shows "GROVES Kaden", source might differ)
          for (const [key, e] of byName.entries()) {
            const ridNorm = normalize(rider.name);
            if (key.includes(ridNorm) || ridNorm.includes(key)) {
              entry = e;
              break;
            }
          }
        }
      }
      if (!entry) continue;
      matched++;
      // Skip update if already same
      if (entry.abandon_type === rider.abandon_type && entry.abandon_etape === rider.abandon_etape) continue;
      updates.push({ id: entry.id, abandon_type: rider.abandon_type, abandon_etape: rider.abandon_etape });
    }

    // Apply updates one by one (small volumes)
    for (const u of updates) {
      await supabase
        .from('startlist_entries')
        .update({ abandon_type: u.abandon_type, abandon_etape: u.abandon_etape, abandon_checked_at: now })
        .eq('id', u.id);
    }

    // Also stamp abandon_checked_at on all entries for this startlist
    await supabase
      .from('startlist_entries')
      .update({ abandon_checked_at: now })
      .eq('startlist_id', race.startlist_id);

    // Reset entries no longer flagged on PCS (if they were previously)
    const flaggedIds = new Set<string>();
    for (const rider of flagged) {
      const entry = (rider.bib && byBib.get(rider.bib)) || byName.get(normalize(rider.name));
      if (entry) flaggedIds.add(entry.id);
    }
    const toClear = (entries || []).filter((e: any) => e.abandon_type && !flaggedIds.has(e.id));
    for (const e of toClear) {
      await supabase
        .from('startlist_entries')
        .update({ abandon_type: null, abandon_etape: null })
        .eq('id', e.id);
    }

    const dnf = updates.filter((u) => u.abandon_type === 'DNF').length;
    const dns = updates.filter((u) => u.abandon_type === 'DNS').length;
    return { race_id: race.id, nom: race.nom, dnf, dns, matched, total_flagged: flagged.length };
  } catch (e: any) {
    console.error(`[abandons] Error for ${race.nom}:`, e);
    return { race_id: race.id, nom: race.nom, dnf: 0, dns: 0, matched: 0, total_flagged: 0, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty body OK */ }
    const targetRaceId: string | null = body?.race_id ?? null;

    const today = new Date().toISOString().split('T')[0];

    // Stage races currently running (no pcs_slug filter; we fall back to startlist_imports.file_url)
    let q = supabase
      .from('courses')
      .select('id, nom, pcs_slug, date_debut, date_fin')
      .lte('date_debut', today)
      .gte('date_fin', today);
    if (targetRaceId) q = q.eq('id', targetRaceId);

    const { data: courses, error: coursesError } = await q;
    if (coursesError) throw coursesError;

    const stageRaces = (courses || []).filter((c: any) => c.date_debut !== c.date_fin || targetRaceId);
    console.log(`[abandons] ${stageRaces.length} active stage races to process`);

    // Get latest startlist_imports for these races (with file_url)
    const raceIds = stageRaces.map((c: any) => c.id);
    const targets: { id: string; nom: string; pcs_slug: string | null; year: number; startlist_id: string; file_url: string | null }[] = [];

    if (raceIds.length > 0) {
      const { data: imports } = await supabase
        .from('startlist_imports')
        .select('id, race_id, parsed_at, file_url')
        .in('race_id', raceIds)
        .order('parsed_at', { ascending: false });

      const latestByRace = new Map<string, { id: string; file_url: string | null }>();
      for (const imp of imports || []) {
        if (!latestByRace.has(imp.race_id)) latestByRace.set(imp.race_id, { id: imp.id, file_url: imp.file_url });
      }

      for (const r of stageRaces) {
        const latest = latestByRace.get(r.id);
        const year = r.date_debut ? parseInt(String(r.date_debut).slice(0, 4), 10) : new Date().getFullYear();
        if (latest) targets.push({ id: r.id, nom: r.nom, pcs_slug: r.pcs_slug, year, startlist_id: latest.id, file_url: latest.file_url });
      }
    }

    const results = [];
    for (const t of targets) {
      results.push(await processRace(supabase, t));
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[abandons] fatal', e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
