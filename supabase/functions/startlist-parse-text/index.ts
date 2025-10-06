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
    .replace(/[''`´]/g, "'")           // Unify apostrophes
    .replace(/[.\-]/g, ' ')            // . and - to space
    .replace(/\s+/g, ' ')              // Multiple spaces to one
    .trim()
    .toUpperCase();
}

// Token signature: sorted unique tokens
function tokenSig(s: string): string {
  return normalize(s).split(' ').sort().join(' ');
}

// Team code bonus (very light)
function teamBonus(dbTeam: string, code: string): number {
  const m = normalize(dbTeam);
  return m.includes(code) ? 0.05 : 0;
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
  while (i < toks.length && /^[A-Z''\-]+$/.test(toks[i])) i++;
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

    // Load all riders
    const { data: riders } = await supabase
      .from('coureurs')
      .select('id, nom, equipe');

    if (!riders) {
      throw new Error('Impossible de charger les coureurs');
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

      // 1) Exact match
      if (riderByNorm.has(entry.normalized)) {
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

      // 3) Fuzzy match (if pg_trgm enabled)
      if (!bestMatch) {
        // Try similarity search (requires pg_trgm)
        const { data: fuzzyMatches } = await supabase
          .rpc('similarity', { 
            target: entry.normalized,
            threshold: 0.75 
          } as any)
          .limit(5);

        if (fuzzyMatches && fuzzyMatches.length > 0) {
          const best = fuzzyMatches[0];
          const bonus = teamBonus(best.equipe || '', entry.team_code || '');
          const finalScore = best.score + bonus;
          
          if (finalScore >= 0.86) {
            bestMatch = best;
            matchType = 'fuzzy';
            matchScore = finalScore;
          }
        }
        
        // Fallback: manual fuzzy
        if (!bestMatch) {
          for (const r of riders) {
            const score = similarity(entry.normalized, normalize(r.nom));
            const bonus = teamBonus(r.equipe || '', entry.team_code || '');
            const finalScore = score + bonus;
            
            if (finalScore >= 0.86 && finalScore > matchScore) {
              matchScore = finalScore;
              bestMatch = r;
              matchType = 'fuzzy';
            }
          }
        }
      }

      if (bestMatch) {
        matched.push({
          ...entry,
          coureur_id: bestMatch.id,
          nom: bestMatch.nom,
          equipe: bestMatch.equipe,
          confidence: matchScore,
          match_type: matchType,
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
          });
        }
      } else {
        // Get suggestions
        const suggestions = riders
          .map(r => ({
            coureur_id: r.id,
            nom: r.nom,
            score: similarity(entry.normalized, normalize(r.nom)) + teamBonus(r.equipe || '', entry.team_code || '')
          }))
          .filter(s => s.score >= 0.70)
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

    // Load rosters for this phase
    const { data: rosters } = await supabase
      .from('rosters')
      .select('coureur_id, manager_id, managers(id, nom)')
      .eq('phase_id', phaseId);

    // Build manager map
    const managerMap = new Map();
    const noOwner: any[] = [];

    for (const m of matched) {
      const roster = rosters?.find(r => r.coureur_id === m.coureur_id);
      
      if (roster && roster.managers) {
        const managerId = (roster.managers as any).id;
        const managerNom = (roster.managers as any).nom;
        
        if (!managerMap.has(managerId)) {
          managerMap.set(managerId, {
            manager_id: managerId,
            manager_nom: managerNom,
            starters: [],
          });
        }
        
        managerMap.get(managerId).starters.push({
          coureur_id: m.coureur_id,
          nom: m.nom,
          equipe: m.equipe,
          team_code: m.team_code,
        });
      } else {
        noOwner.push({
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

    // Count matched on_roster
    const onRoster = matched.filter(m => {
      return rosters?.some(r => r.coureur_id === m.coureur_id);
    }).length;

    return new Response(
      JSON.stringify({
        phase_id: phaseId,
        race_id: raceId,
        counts: {
          parsed: parsedEntries.length,
          matched_db: matched.length,
          on_roster: onRoster,
          unmatched: unmatched.length,
        },
        managers,
        no_owner: noOwner.sort((a, b) => a.nom.localeCompare(b.nom)),
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
