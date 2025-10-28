import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Normalization utilities (inlined to avoid bundling issues)
const CHAR_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
  'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y', 'ß': 'ss', 'œ': 'oe',
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
  'Ç': 'C', 'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
  'Ñ': 'N', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
  'Ý': 'Y', 'Ÿ': 'Y', 'Œ': 'OE'
};

const PARTICLES = ['VAN', 'VAN DER', 'VAN DEN', 'VAN DE', 'DE', 'DI', 'DA', 'DEL', 'DELLA', 'VON', 'LE', 'LA'];

function normalize(s: string): string {
  if (!s) return '';
  let result = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  result = result.split('').map(c => CHAR_MAP[c] || c).join('');
  result = result.replace(/['']/g, "'").replace(/[.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return result.toUpperCase();
}

function tokenSig(s: string): string {
  return normalize(s).split(/\s+/).filter(t => t.length > 0).sort().join(' ');
}

function extractLastName(s: string): string {
  const norm = normalize(s);
  const tokens = norm.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return '';
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!PARTICLES.includes(tokens[i])) return tokens[i];
  }
  return tokens[tokens.length - 1];
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  for (let i = 0; i <= n; i++) matrix[i] = [i];
  for (let j = 0; j <= m; j++) (matrix[0] as any)[j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      (matrix[i] as any)[j] = Math.min((matrix[i - 1] as any)[j] + 1, (matrix[i] as any)[j - 1] + 1, (matrix[i - 1] as any)[j - 1] + cost);
    }
  }
  return (matrix[n] as any)[m];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - (levenshtein(a, b) / maxLen);
}

function canonizeName(raw: string): string {
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 2) return raw;
  const firstToken = tokens[0];
  const isFirstAllCaps = firstToken === firstToken.toUpperCase() && firstToken.length > 1;
  if (isFirstAllCaps) {
    let lastNameEndIdx = 0;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      // Include both all-caps tokens AND particles in the last name
      if ((tok === tok.toUpperCase() && tok.length > 1) || PARTICLES.includes(tok)) {
        lastNameEndIdx = i;
      } else {
        break;
      }
    }
    const lastName = tokens.slice(0, lastNameEndIdx + 1).join(' ');
    const firstName = tokens.slice(lastNameEndIdx + 1).join(' ');
    if (firstName && lastName) return `${firstName} ${lastName}`;
  }
  return raw;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ PARSING DU TEXTE ============

interface ParsedEntry {
  line_no: number;
  bib_no?: string;
  source_team?: string;
  source_name: string;
  canonical_guess: string;
  normalized: string;
  key_sig: string;
}

function parseStartlistText(raw_text: string): ParsedEntry[] {
  const lines = raw_text.split(/\r?\n/);
  const entries: ParsedEntry[] = [];
  
  // Regex patterns (with optional period after place number, 2-4 chars team code, optional time suffix)
  // fullPattern: TEAM NAME [TIME] (greedy name capture with optional time)
  const fullPattern = /^\s*(?<place>\d+)?\.?\s*(?<team>[A-Z0-9]{2,4})\s+(?<name>[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒŠ\s\'\-\.]+?)(?:\s+[\d:]+)?$/i;
  // endTeamPattern: NAME TEAM [TIME] (team code at end with optional time)
  const endTeamPattern = /^\s*(?<place>\d+)?\.?\s*(?<name>[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒŠ\s\'\-\.]+?)\s+(?<team>[A-Z0-9]{2,4})(?:\s+[\d:]+)?$/i;
  // loosePattern: just NAME [TIME] (no team, optional time)
  const loosePattern = /^\s*(?<place>\d+)?\.?\s*(?<name>[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒŠ\s\'\-\.]+?)(?:\s+[\d:]+)?$/i;
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return;
    
    // Try patterns in order: fullPattern → endTeamPattern → loosePattern
    let match = trimmed.match(fullPattern);
    if (!match) {
      match = trimmed.match(endTeamPattern);
    }
    if (!match) {
      match = trimmed.match(loosePattern);
    }
    
    if (match && match.groups?.name) {
      const sourceName = match.groups.name.trim();
      const canonical = canonizeName(sourceName);
      const norm = normalize(canonical);
      const sig = tokenSig(canonical);
      
      const entry = {
        line_no: idx + 1,
        bib_no: match.groups.place || undefined,
        source_team: match.groups.team || undefined,
        source_name: sourceName,
        canonical_guess: canonical,
        normalized: norm,
        key_sig: sig
      };
      
      entries.push(entry);
      
      // Debug log for first 3 entries
      if (entries.length <= 3) {
        console.log(`[PARSE] Entry ${entries.length}: line_no=${entry.line_no}, team=${entry.source_team}, source="${entry.source_name}", canonical="${entry.canonical_guess}"`);
      }
    }
  });
  
  console.log(`[PARSE] Total parsed: ${entries.length} entries`);
  return entries;
}

// ============ MATCHING LOGIC ============

interface RiderRef {
  id: string;
  nom: string;
  equipe: string | null;
}

interface AliasRef {
  alias_text: string;
  coureur_id: string;
  source_team: string | null;
}

interface MatchResult {
  coureur_id: string | null;
  confidence: number;
  status: 'confirmed' | 'unmatched';
  match_type?: string;
  on_roster?: boolean;
  suggestions?: Array<{ coureur_id: string; nom: string; equipe: string | null; similarity: number }>;
}

function matchEntry(
  entry: ParsedEntry,
  rosterRiders: RiderRef[],
  allRiders: RiderRef[],
  aliases: AliasRef[]
): MatchResult {
  const entryNorm = normalize(entry.canonical_guess);
  const entryLastName = extractLastName(entry.canonical_guess);
  const entrySig = tokenSig(entry.canonical_guess);
  
  // 1) Alias (prio max)
  for (const alias of aliases) {
    if (normalize(alias.alias_text) === entryNorm) {
      const isOnRoster = rosterRiders.some(r => r.id === alias.coureur_id);
      return {
        coureur_id: alias.coureur_id,
        confidence: 1.0,
        status: 'confirmed',
        match_type: 'alias',
        on_roster: isOnRoster
      };
    }
  }
  
  // 2) Exact normalisé (roster only)
  for (const rider of rosterRiders) {
    if (normalize(rider.nom) === entryNorm) {
      return {
        coureur_id: rider.id,
        confidence: 1.0,
        status: 'confirmed',
        match_type: 'exact',
        on_roster: true
      };
    }
  }
  
  // 3) Signature de tokens (roster only) + même nom de famille
  for (const rider of rosterRiders) {
    const riderSig = tokenSig(rider.nom);
    const riderLastName = extractLastName(rider.nom);
    
    if (riderSig === entrySig && riderLastName === entryLastName) {
      return {
        coureur_id: rider.id,
        confidence: 0.95,
        status: 'confirmed',
        match_type: 'tokens',
        on_roster: true
      };
    }
  }
  
  // 4) Fuzzy Levenshtein (roster only) + même nom de famille
  let best = { id: null as string | null, score: 0 };
  for (const rider of rosterRiders) {
    const riderLastName = extractLastName(rider.nom);
    if (riderLastName !== entryLastName) continue;
    
    const score = similarity(entryNorm, normalize(rider.nom));
    if (score > best.score) {
      best = { id: rider.id, score };
    }
  }
  
  if (best.id && best.score >= 0.90) {
    return {
      coureur_id: best.id,
      confidence: best.score,
      status: 'confirmed',
      match_type: 'fuzzy_roster',
      on_roster: true
    };
  }
  
  // 5) FALLBACK sur allRiders (off-roster)
  // 5a) Exact match
  for (const rider of allRiders) {
    if (normalize(rider.nom) === entryNorm) {
      return {
        coureur_id: rider.id,
        confidence: 1.0,
        status: 'confirmed',
        match_type: 'exact_off_roster',
        on_roster: false
      };
    }
  }
  
  // 5b) TokenSig + même nom de famille
  for (const rider of allRiders) {
    const riderSig = tokenSig(rider.nom);
    const riderLastName = extractLastName(rider.nom);
    
    if (riderSig === entrySig && riderLastName === entryLastName) {
      return {
        coureur_id: rider.id,
        confidence: 0.95,
        status: 'confirmed',
        match_type: 'tokens_off_roster',
        on_roster: false
      };
    }
  }
  
  // 5c) Fuzzy + même nom de famille (seuil plus strict pour off-roster)
  let bestOffRoster = { id: null as string | null, score: 0 };
  for (const rider of allRiders) {
    const riderLastName = extractLastName(rider.nom);
    if (riderLastName !== entryLastName) continue;
    
    const score = similarity(entryNorm, normalize(rider.nom));
    if (score > bestOffRoster.score) {
      bestOffRoster = { id: rider.id, score };
    }
  }
  
  if (bestOffRoster.id && bestOffRoster.score >= 0.92) {
    return {
      coureur_id: bestOffRoster.id,
      confidence: bestOffRoster.score,
      status: 'confirmed',
      match_type: 'fuzzy_off_roster',
      on_roster: false
    };
  }
  
  // 6) Unmatched + suggestions combinées roster + allRiders
  const rosterSuggestions = rosterRiders
    .filter(r => extractLastName(r.nom) === entryLastName)
    .map(r => ({
      coureur_id: r.id,
      nom: r.nom,
      equipe: r.equipe,
      similarity: similarity(entryNorm, normalize(r.nom))
    }));
    
  const offRosterSuggestions = allRiders
    .filter(r => extractLastName(r.nom) === entryLastName)
    .filter(r => !rosterRiders.some(rr => rr.id === r.id))
    .map(r => ({
      coureur_id: r.id,
      nom: r.nom,
      equipe: r.equipe,
      similarity: similarity(entryNorm, normalize(r.nom))
    }));
  
  const suggestions = [...rosterSuggestions, ...offRosterSuggestions]
    .filter(x => x.similarity >= 0.75)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
  
  return {
    coureur_id: null,
    confidence: 0,
    status: 'unmatched',
    suggestions
  };
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check admin access
    const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || !isAdminData) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { race_id, created_by_manager_id, raw_text, note } = body;

    if (!race_id || !raw_text) {
      return new Response(
        JSON.stringify({ error: 'race_id et raw_text requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[startlist-import] Starting import for race ${race_id}`);

    // Résoudre phase_id
    const { data: raceData, error: raceError } = await supabase
      .from('courses')
      .select('phase_id')
      .eq('id', race_id)
      .single();

    if (raceError || !raceData?.phase_id) {
      return new Response(
        JSON.stringify({ error: 'Course introuvable ou phase_id manquant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phase_id = raceData.phase_id;
    console.log(`[startlist-import] Phase ID: ${phase_id}`);

    // Parse le texte
    const parsedEntries = parseStartlistText(raw_text);
    console.log(`[startlist-import] Parsed ${parsedEntries.length} entries`);

    // Charger roster unique de la phase
    const { data: rostersData, error: rostersError } = await supabase
      .from('rosters')
      .select('coureur_id, coureurs!inner(id, nom, equipe)')
      .eq('phase_id', phase_id);

    if (rostersError) throw rostersError;

    const rosterRiders: RiderRef[] = [];
    const seenIds = new Set<string>();
    
    for (const r of rostersData || []) {
      const coureur = (r as any).coureurs;
      if (coureur && !seenIds.has(coureur.id)) {
        rosterRiders.push({
          id: coureur.id,
          nom: coureur.nom,
          equipe: coureur.equipe
        });
        seenIds.add(coureur.id);
      }
    }

    console.log(`[startlist-import] Loaded ${rosterRiders.length} unique riders from roster`);

    // Charger tous les coureurs (pour alias off-roster)
    const { data: allRidersData, error: allRidersError } = await supabase
      .from('coureurs')
      .select('id, nom, equipe');

    if (allRidersError) throw allRidersError;

    const allRiders: RiderRef[] = (allRidersData || []).map(r => ({
      id: r.id,
      nom: r.nom,
      equipe: r.equipe
    }));

    // Charger name_aliases
    const { data: aliasesData, error: aliasesError } = await supabase
      .from('name_aliases')
      .select('alias_text, coureur_id, source_team');

    if (aliasesError) throw aliasesError;

    const aliases: AliasRef[] = (aliasesData || []).map(a => ({
      alias_text: a.alias_text,
      coureur_id: a.coureur_id,
      source_team: a.source_team
    }));

    console.log(`[startlist-import] Loaded ${aliases.length} name aliases`);

    // Créer l'en-tête
    const { data: importData, error: importError } = await supabase
      .from('startlist_imports')
      .insert({
        race_id,
        created_by_manager_id,
        raw_text,
        startlisteur_note: note || null
      })
      .select('id')
      .single();

    if (importError) throw importError;

    const startlist_id = importData.id;
    console.log(`[startlist-import] Created import ${startlist_id}`);

    // Matcher et sauvegarder les entrées
    let confirmedCount = 0;
    let unmatchedCount = 0;

    const entriesToInsert = parsedEntries.map((entry, idx) => {
      const matchResult = matchEntry(entry, rosterRiders, allRiders, aliases);
      
      // Debug log for first match
      if (idx === 0) {
        console.log(`[MATCH] First match: coureur_id=${matchResult.coureur_id}, strategy="${matchResult.match_type || 'none'}", confidence=${matchResult.confidence}, on_roster=${matchResult.on_roster || false}`);
      }
      
      if (matchResult.status === 'confirmed') {
        confirmedCount++;
      } else {
        unmatchedCount++;
      }

      return {
        startlist_id,
        line_no: entry.line_no,
        bib_no: entry.bib_no || null,
        source_name: entry.source_name,
        source_team: entry.source_team || null,
        coureur_id: matchResult.coureur_id,
        confidence: matchResult.confidence,
        status: matchResult.status
      };
    });

    if (entriesToInsert.length > 0) {
      const { error: entriesError } = await supabase
        .from('startlist_entries')
        .insert(entriesToInsert);

      if (entriesError) throw entriesError;
    }

    console.log(`[SUMMARY] Parsed ${parsedEntries.length} entries → ${confirmedCount} confirmed, ${unmatchedCount} unmatched`);

    return new Response(
      JSON.stringify({
        startlist_id,
        counts: {
          total: parsedEntries.length,
          confirmed: confirmedCount,
          unmatched: unmatchedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[startlist-import] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
