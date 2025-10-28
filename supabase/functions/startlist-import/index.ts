import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalize, tokenSig, extractLastName, similarity, canonizeName } from "../_shared/normalization.ts";

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
  
  // Regex patterns (with optional period after place number)
  const fullPattern = /^\s*(?<place>\d+)?\.?\s*(?<team>[A-Z]{3})\s+(?<name>[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒŠ\s\'\-\.]+?)(?:\s+(?<rest>.*))?$/i;
  const loosePattern = /^\s*(?<place>\d+)?\.?\s*(?<team>[A-Z]{3})?\s+(?<name>[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒŠ\s\'\-\.]+)$/i;
  
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
