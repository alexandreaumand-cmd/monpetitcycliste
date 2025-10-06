import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize text for matching (unaccent + clean)
function normalize(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // Remove accents
    .replace(/[''`´'']/g, "'")         // Unify all apostrophe variants
    .replace(/[.\-]/g, ' ')            // . and - to space
    .replace(/\s+/g, ' ')              // Multiple spaces to one
    .trim()
    .toUpperCase();
}

// Token signature: sorted unique tokens
function tokenSig(s: string): string {
  return normalize(s).split(' ').sort().join(' ');
}


// Simple Levenshtein distance
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1)
function similarity(a: string, b: string): number {
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// Canonicalize: "TRENTIN Matteo" -> "Matteo TRENTIN"
function canonizeName(nameRaw: string): string {
  const toks = (nameRaw || '').trim().split(/\s+/);
  let i = 0;
  // Cluster of ALLCAPS tokens at start (surname: DE, VAN, TRENTIN, etc.)
  while (i < toks.length && /^[A-Z''''\-]+$/.test(toks[i])) i++;
  const surname = toks.slice(0, i).join(' ').toUpperCase();
  const given = toks.slice(i).map(t => t.charAt(0) + t.slice(1).toLowerCase()).join(' ');
  return (given && surname) ? `${given} ${surname}` : nameRaw;
}

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

    const { race_id, phase_id, text, with_diagnostics } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Le texte est requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine phase
    let phaseId = phase_id;
    let raceId = race_id;
    
    if (race_id && !phase_id) {
      const { data: race } = await supabase
        .from('courses')
        .select('phase_id')
        .eq('id', race_id)
        .single();
      
      if (race) {
        phaseId = race.phase_id;
      }
    }

    if (!phaseId) {
      return new Response(
        JSON.stringify({ error: 'phase_id ou race_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse lines
    const lines = text.split('\n').filter((l: string) => l.trim());
    const parsedEntries: any[] = [];
    const diagnostics: any[] = [];
    
    const reFull = /^\s*\d+\.\s+([A-Z]{2,4})\s+(.+?)\s+([+\-−]?\d+:\d+|\d+:\d+)\s*$/i;
    const reLoose = /^\s*\d+\.\s+([A-Z]{2,4})\s+(.+?)\s*$/i;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const match = line.match(reFull) || line.match(reLoose);
      if (match) {
        const teamCode = match[1].toUpperCase();
        const nameRaw = match[2].trim();
        const canonicalGuess = canonizeName(nameRaw);
        const normalized = normalize(canonicalGuess);
        
        parsedEntries.push({
          line_no: i + 1,
          team_code: teamCode,
          source_name: nameRaw,
          canonical_guess: canonicalGuess,
          normalized,
          key_sig: tokenSig(canonicalGuess),
        });
      }
    }

    // Load rosters + coureurs for the phase (matching only against roster)
    const { data: rostersData } = await supabase
      .from('rosters')
      .select('coureur_id, manager_id, coureurs(id, nom, equipe), managers(id, nom)')
      .eq('phase_id', phaseId);

    if (!rostersData) {
      throw new Error('Impossible de charger les rosters');
    }

    // Extract unique riders from rosters
    const riders: any[] = [];
    const rostersByRider = new Map<string, any[]>();
    
    for (const r of rostersData) {
      if (r.coureurs) {
        const coureur = r.coureurs as any;
        // Add to riders if not already present
        if (!riders.some((c: any) => c.id === coureur.id)) {
          riders.push(coureur);
        }
        
        // Track manager ownership
        if (!rostersByRider.has(r.coureur_id)) {
          rostersByRider.set(r.coureur_id, []);
        }
        const manager = r.managers as any;
        rostersByRider.get(r.coureur_id)!.push({
          manager_id: r.manager_id,
          manager_nom: manager?.nom,
        });
      }
    }

    // Load name aliases for pre-matching
    const { data: aliases } = await supabase
      .from('name_aliases')
      .select('alias_text, coureur_id, source_team');

    const aliasMap = new Map<string, string>();
    if (aliases) {
      for (const a of aliases) {
        const key = normalize(a.alias_text);
        aliasMap.set(key, a.coureur_id);
      }
    }

    // Build maps for fast lookup
    const riderByNorm = new Map<string, any>();
    const riderBySig = new Map<string, any>();
    
    for (const r of riders) {
      const norm = normalize(r.nom);
      const sig = tokenSig(r.nom);
      if (!riderByNorm.has(norm)) riderByNorm.set(norm, r);
      if (!riderBySig.has(sig)) riderBySig.set(sig, r);
    }

    // Match each entry
    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const entry of parsedEntries) {
      let bestMatch = null;
      let matchType = 'none';
      let matchScore = 0;

      // 0) Alias match (highest priority)
      const aliasKey = normalize(entry.source_name);
      if (aliasMap.has(aliasKey)) {
        const coureurId = aliasMap.get(aliasKey);
        bestMatch = riders.find(r => r.id === coureurId);
        if (bestMatch) {
          matchType = 'alias';
          matchScore = 1.0;
        }
      }

      // 1) Exact match
      if (!bestMatch && riderByNorm.has(entry.normalized)) {
        bestMatch = riderByNorm.get(entry.normalized);
        matchType = 'exact';
        matchScore = 1.0;
      }
      
      // 2) Token signature match
      if (!bestMatch && riderBySig.has(entry.key_sig)) {
        bestMatch = riderBySig.get(entry.key_sig);
        matchType = 'tokens';
        matchScore = 0.95;
      }

      // 3) Fuzzy match (manual only, no RPC)
      if (!bestMatch) {
        for (const r of riders) {
          const finalScore = similarity(entry.normalized, normalize(r.nom));
          
          if (finalScore >= 0.84 && finalScore > matchScore) {
            matchScore = finalScore;
            bestMatch = r;
            matchType = 'fuzzy';
          }
        }
      }

      if (bestMatch) {
        // All matched riders are on_roster (we only match against rosters)
        matched.push({
          ...entry,
          coureur_id: bestMatch.id,
          nom: bestMatch.nom,
          equipe: bestMatch.equipe,
          confidence: matchScore,
          match_type: matchType,
          on_roster: true,
        });

        if (with_diagnostics) {
          diagnostics.push({
            line_no: entry.line_no,
            team_code: entry.team_code,
            name_raw: entry.source_name,
            canonical_guess: entry.canonical_guess,
            normalized: entry.normalized,
            match_type: matchType,
            score: matchScore,
            db_nom: bestMatch.nom,
            db_equipe: bestMatch.equipe,
            on_roster: true,
          });
        }
      } else {
        // Get suggestions (all suggestions are from roster)
        const suggestions = riders
          .map(r => {
            const score = similarity(entry.normalized, normalize(r.nom));
            return {
              coureur_id: r.id,
              nom: r.nom,
              equipe: r.equipe,
              score,
              on_roster: true,
            };
          })
          .filter(s => s.score >= 0.65)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        unmatched.push({
          ...entry,
          suggestions,
        });

        if (with_diagnostics) {
          diagnostics.push({
            line_no: entry.line_no,
            team_code: entry.team_code,
            name_raw: entry.source_name,
            canonical_guess: entry.canonical_guess,
            normalized: entry.normalized,
            match_type: 'none',
          });
        }
      }
    }

    // Build manager map using rostersByRider
    const managerMap = new Map();

    for (const m of matched) {
      const owners = rostersByRider.get(m.coureur_id) || [];
      
      for (const owner of owners) {
        if (!managerMap.has(owner.manager_id)) {
          managerMap.set(owner.manager_id, {
            manager_id: owner.manager_id,
            manager_nom: owner.manager_nom,
            starters: [],
          });
        }
        
        managerMap.get(owner.manager_id).starters.push({
          coureur_id: m.coureur_id,
          nom: m.nom,
          equipe: m.equipe,
          team_code: m.team_code,
        });
      }
    }

    // Build final managers array
    const managers = Array.from(managerMap.values()).map(m => ({
      ...m,
      starters_count: m.starters.length,
      starters: m.starters.sort((a: any, b: any) => a.nom.localeCompare(b.nom)),
    })).sort((a, b) => b.starters_count - a.starters_count);

    return new Response(
      JSON.stringify({
        phase_id: phaseId,
        race_id: raceId,
        counts: {
          parsed: parsedEntries.length,
          matched_db: matched.length,
          on_roster: matched.length, // All matched are on roster
          unmatched: unmatched.length,
        },
        managers,
        unmatched: unmatched.sort((a, b) => a.line_no - b.line_no),
        diagnostics: with_diagnostics ? diagnostics : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in startlist-parse-text:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
