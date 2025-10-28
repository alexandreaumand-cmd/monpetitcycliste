import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ NORMALISATION & UTILITAIRES V2 ============

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
  'Ý': 'Y', 'Ÿ': 'Y', 'Œ': 'OE',
  'Š': 'S', 'š': 's', 'Ž': 'Z', 'ž': 'z',
  'Đ': 'D', 'đ': 'd', 'Ł': 'L', 'ł': 'l',
  'Ń': 'N', 'ń': 'n', 'Ř': 'R', 'ř': 'r',
  'Ś': 'S', 'ś': 's', 'Ť': 'T', 'ť': 't',
  'Ů': 'U', 'ů': 'u', 'Ź': 'Z', 'ź': 'z', 'Ż': 'Z', 'ż': 'z'
};

const PARTICLES = ['VAN', 'VAN DER', 'VAN DEN', 'VAN DE', 'DE', 'DI', 'DA', 'DEL', 'DELLA', 'VON', 'LE', 'LA', 'LOS', 'LAS'];

function normalize(s: string): string {
  if (!s) return '';
  
  // NFKD + remove accents
  let result = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  
  // Char map fallback
  result = result.split('').map(c => CHAR_MAP[c] || c).join('');
  
  // Unifier apostrophes
  result = result.replace(/['']/g, "'");
  
  // Remplacer . et - par espace
  result = result.replace(/[.\-]/g, ' ');
  
  // Réduire espaces multiples
  result = result.replace(/\s+/g, ' ').trim();
  
  return result.toUpperCase();
}

function tokenSig(s: string): string {
  const norm = normalize(s);
  const tokens = norm.split(/\s+/).filter(t => t.length > 0);
  return tokens.sort().join(' ');
}

function extractLastName(s: string): string {
  const norm = normalize(s);
  const tokens = norm.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return '';
  
  // Si contient des particules, prendre le dernier token non-particule
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!PARTICLES.includes(tokens[i])) {
      return tokens[i];
    }
  }
  return tokens[tokens.length - 1];
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  const n = a.length;
  const m = b.length;

  if (n === 0) return m;
  if (m === 0) return n;

  for (let i = 0; i <= n; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= m; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[n][m];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(a, b);
  return 1.0 - (dist / maxLen);
}

function canonizeName(raw: string): string {
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 2) return raw;
  
  // Détecter si tokens ALLCAPS au milieu/fin = nom
  // Pattern: "TRENTIN Matteo" → "Matteo TRENTIN"
  const firstToken = tokens[0];
  const isFirstAllCaps = firstToken === firstToken.toUpperCase() && firstToken.length > 1;
  
  if (isFirstAllCaps) {
    // Chercher premier token non-ALLCAPS (prénom)
    let lastNameEndIdx = 0;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === tok.toUpperCase() && tok.length > 1 && !PARTICLES.includes(tok)) {
        lastNameEndIdx = i;
      } else {
        break;
      }
    }
    
    const lastName = tokens.slice(0, lastNameEndIdx + 1).join(' ');
    const firstName = tokens.slice(lastNameEndIdx + 1).join(' ');
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
  }
  
  return raw;
}

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
  
  // Regex patterns
  const fullPattern = /^\s*(?<place>\d+)?\s*(?<team>[A-Z]{3})\s+(?<name>[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒŠ\s\'\-\.]+?)(?:\s+(?<rest>.*))?$/i;
  const loosePattern = /^\s*(?<place>\d+)?\s*(?<team>[A-Z]{3})?\s+(?<name>[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒŠ\s\'\-\.]+)$/i;
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return;
    
    let match = trimmed.match(fullPattern);
    if (!match) {
      match = trimmed.match(loosePattern);
    }
    
    if (match && match.groups?.name) {
      const sourceName = match.groups.name.trim();
      const canonical = canonizeName(sourceName);
      const norm = normalize(sourceName);
      
      entries.push({
        line_no: idx + 1,
        bib_no: match.groups.place || undefined,
        source_team: match.groups.team || undefined,
        source_name: sourceName,
        canonical_guess: canonical,
        normalized: norm,
        key_sig: tokenSig(sourceName)
      });
    }
  });
  
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
  const entryNorm = entry.normalized;
  const entryLastName = extractLastName(entry.source_name);
  const entrySig = entry.key_sig;
  
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
      match_type: 'fuzzy',
      on_roster: true
    };
  }
  
  // 5) Unmatched + suggestions
  const suggestions = rosterRiders
    .filter(r => extractLastName(r.nom) === entryLastName)
    .map(r => ({
      coureur_id: r.id,
      nom: r.nom,
      equipe: r.equipe,
      similarity: similarity(entryNorm, normalize(r.nom))
    }))
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

    const entriesToInsert = parsedEntries.map(entry => {
      const matchResult = matchEntry(entry, rosterRiders, allRiders, aliases);
      
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

    console.log(`[startlist-import] Saved ${entriesToInsert.length} entries (${confirmedCount} confirmed, ${unmatchedCount} unmatched)`);

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
