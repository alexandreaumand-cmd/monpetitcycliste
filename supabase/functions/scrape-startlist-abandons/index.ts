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

  // Match each <li> entry (PCS uses <li> for riders)
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRegex.exec(cleaned)) !== null) {
    const liContent = m[1];
    const text = liContent.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const abandonMatch = text.match(/\((DNF|DNS|OTL|DSQ)\s*#?\s*(\d+)\)/i);
    if (!abandonMatch) continue;

    const rawType = abandonMatch[1].toUpperCase();
    // We only track DNF/DNS per user request; map OTL -> DNF (out of time = abandon)
    const abandon_type: 'DNF' | 'DNS' = rawType === 'DNS' ? 'DNS' : 'DNF';
    const abandon_etape = parseInt(abandonMatch[2], 10);
    if (!Number.isFinite(abandon_etape)) continue;

    // Extract bib (leading number) and name
    const bibMatch = text.match(/^\s*(\d{1,4})\s+/);
    const bib = bibMatch ? bibMatch[1] : null;

    // Name = text between bib and "(DNF/DNS"
    let nameSection = text;
    if (bib) nameSection = nameSection.replace(/^\s*\d{1,4}\s+/, '');
    nameSection = nameSection.split('(')[0].trim();
    // Strip trailing asterisks etc.
    const name = nameSection.replace(/\*+$/, '').trim();

    if (!name) continue;
    out.push({ bib, name, abandon_type, abandon_etape });
  }
  return out;
}

async function processRace(
  supabase: any,
  race: { id: string; nom: string; pcs_slug: string; year: number; startlist_id: string }
): Promise<{ race_id: string; nom: string; dnf: number; dns: number; matched: number; total_flagged: number; error?: string }> {
  try {
    const url = `${PCS_BASE}/race/${race.pcs_slug}/${race.year}/startlist`;
    console.log(`[abandons] Fetching ${url}`);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LabordureBot/1.0)' },
    });
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

    // Stage races currently running
    let q = supabase
      .from('courses')
      .select('id, nom, pcs_slug, date_debut, date_fin')
      .not('pcs_slug', 'is', null)
      .lte('date_debut', today)
      .gte('date_fin', today);
    if (targetRaceId) q = q.eq('id', targetRaceId);

    const { data: courses, error: coursesError } = await q;
    if (coursesError) throw coursesError;

    const stageRaces = (courses || []).filter((c: any) => c.date_debut !== c.date_fin || targetRaceId);
    console.log(`[abandons] ${stageRaces.length} active stage races to process`);

    // Get latest startlist_imports for these races
    const raceIds = stageRaces.map((c: any) => c.id);
    const targets: { id: string; nom: string; pcs_slug: string; year: number; startlist_id: string }[] = [];

    if (raceIds.length > 0) {
      const { data: imports } = await supabase
        .from('startlist_imports')
        .select('id, race_id, parsed_at')
        .in('race_id', raceIds)
        .order('parsed_at', { ascending: false });

      const latestByRace = new Map<string, string>();
      for (const imp of imports || []) {
        if (!latestByRace.has(imp.race_id)) latestByRace.set(imp.race_id, imp.id);
      }

      for (const r of stageRaces) {
        const sid = latestByRace.get(r.id);
        const year = r.date_debut ? parseInt(String(r.date_debut).slice(0, 4), 10) : new Date().getFullYear();
        if (sid) targets.push({ id: r.id, nom: r.nom, pcs_slug: r.pcs_slug, year, startlist_id: sid });
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
