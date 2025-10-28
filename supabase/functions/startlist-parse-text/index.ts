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


// Extract last name from normalized text
function extractLastName(normalized: string): string {
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return '';
  return tokens[tokens.length - 1];
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

    const { race_id, phase_id, text, with_diagnostics, startlisteur_note, league_id } = await req.json();

    console.info('📋 Input validation:', { race_id, phase_id, text_length: text?.length, league_id });

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Le texte est requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // league_id is now optional for global imports

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

    // VALIDATION: race_id est requis pour enregistrer la startlist
    if (!raceId) {
      console.error('❌ race_id is required to save startlist');
      return new Response(JSON.stringify({ 
        error: 'race_id est requis pour enregistrer la startlist. Veuillez sélectionner une course.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse lines
    const lines = text.split('\n').filter((l: string) => l.trim());
    const parsedEntries: any[] = [];
    const diagnostics: any[] = [];
    
    const reFull = /^\s*\d+\.\s+([A-Z0-9]{2,4})\s+(.+?)\s+([+\-−]?\d+:\d+|\d+:\d+)\s*$/i;
    const reLoose = /^\s*\d+\.\s+([A-Z0-9]{2,4})\s+(.+?)\s*$/i;
    
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

    // Load rosters for matching (only if league_id provided)
    let rostersData: any[] = [];
    if (league_id) {
      const { data } = await supabase
        .from('rosters')
        .select('coureur_id, manager_id, coureurs(id, nom, equipe), managers(id, nom)')
        .eq('phase_id', phaseId)
        .eq('league_id', league_id);
      rostersData = data || [];
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

    // Load ALL coureurs (not just from rosters) for off-roster matching
    const { data: allCoureurs } = await supabase
      .from('coureurs')
      .select('id, nom, equipe');

    if (!allCoureurs) {
      throw new Error('Impossible de charger les coureurs');
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

    // Build maps for fast lookup (from rosters)
    const riderByNorm = new Map<string, any>();
    const riderBySig = new Map<string, any>();
    
    for (const r of riders) {
      const norm = normalize(r.nom);
      const sig = tokenSig(r.nom);
      if (!riderByNorm.has(norm)) riderByNorm.set(norm, r);
      if (!riderBySig.has(sig)) riderBySig.set(sig, r);
    }

    // Build ALL coureurs map (includes off-roster) with last name info
    const allCoureursMap = new Map<string, any>();
    for (const c of allCoureurs) {
      allCoureursMap.set(c.id, {
        ...c,
        lastName: extractLastName(normalize(c.nom))
      });
    }

    // Match each entry
    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const entry of parsedEntries) {
      let bestMatch = null;
      let matchType = 'none';
      let matchScore = 0;
      let onRoster = false;

      const entryLastName = extractLastName(entry.normalized);

      // 0) Alias match (highest priority) - check both roster and all coureurs
      const aliasKey = normalize(entry.source_name);
      if (aliasMap.has(aliasKey)) {
        const coureurId = aliasMap.get(aliasKey);
        if (coureurId) {
          // Try roster first
          bestMatch = riders.find(r => r.id === coureurId);
          if (bestMatch) {
            matchType = 'alias';
            matchScore = 1.0;
            onRoster = true;
          } else {
            // Check all coureurs (off-roster)
            const offRosterCoureur = allCoureursMap.get(coureurId);
            if (offRosterCoureur) {
              bestMatch = offRosterCoureur;
              matchType = 'alias';
              matchScore = 1.0;
              onRoster = false;
            }
          }
        }
      }

      // 1) Exact match (roster only)
      if (!bestMatch && riderByNorm.has(entry.normalized)) {
        bestMatch = riderByNorm.get(entry.normalized);
        matchType = 'exact';
        matchScore = 1.0;
        onRoster = true;
      }
      
      // 2) Token signature match (roster only, with last name guard)
      if (!bestMatch && riderBySig.has(entry.key_sig)) {
        const candidate = riderBySig.get(entry.key_sig);
        const candidateLastName = extractLastName(normalize(candidate.nom));
        
        if (candidateLastName === entryLastName) {
          bestMatch = candidate;
          matchType = 'tokens';
          matchScore = 0.95;
          onRoster = true;
        }
      }

      // 3) Fuzzy match (roster only, with strict last name guard)
      if (!bestMatch) {
        for (const r of riders) {
          const riderLastName = extractLastName(normalize(r.nom));
          
          // STRICT: Only consider if last names match exactly
          if (riderLastName !== entryLastName) {
            continue;
          }
          
          const finalScore = similarity(entry.normalized, normalize(r.nom));
          
          if (finalScore >= 0.9 && finalScore > matchScore) {
            matchScore = finalScore;
            bestMatch = r;
            matchType = 'fuzzy';
            onRoster = true;
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
          on_roster: onRoster,
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
            on_roster: onRoster,
          });
        }
      } else {
        // Get suggestions (roster only, with strict last name guard)
        const suggestions = riders
          .map(r => {
            const riderLastName = extractLastName(normalize(r.nom));
            
            // STRICT: Only suggest if last names match
            if (riderLastName !== entryLastName) {
              return null;
            }
            
            const score = similarity(entry.normalized, normalize(r.nom));
            return {
              coureur_id: r.id,
              nom: r.nom,
              equipe: r.equipe,
              score,
              on_roster: true,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null && s.score >= 0.65)
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

    // Build manager map using rostersByRider (only for on_roster matches)
    const managerMap = new Map();
    const withoutOwner: any[] = [];

    for (const m of matched) {
      if (m.on_roster) {
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
      } else {
        // Off-roster matched coureur
        withoutOwner.push({
          coureur_id: m.coureur_id,
          nom: m.nom,
          equipe: m.equipe,
        });
      }
    }

    // Build final managers array
    const managers = Array.from(managerMap.values()).map(m => ({
      ...m,
      starters_count: m.starters.length,
      starters: m.starters.sort((a: any, b: any) => a.nom.localeCompare(b.nom)),
    })).sort((a, b) => b.starters_count - a.starters_count);

    // ===== SAVE TO DATABASE =====
    // Get current manager ID (optional for superadmins)
    const { data: userData } = await supabase.auth.getUser();
    const { data: managerData } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', userData?.user?.id)
      .maybeSingle();

    if (!managerData) {
      console.warn('⚠️ No manager found for user:', userData?.user?.id, '(allowed for superadmins)');
    }

    const createdByManagerId = managerData?.id ?? null;

    // Create startlist_imports record
    const { data: importRecord, error: importError } = await supabase
      .from('startlist_imports')
      .insert({
        race_id: raceId,
        created_by_manager_id: createdByManagerId,
        raw_text: text,
        startlisteur_note: startlisteur_note,
      })
      .select()
      .single();

    if (importError || !importRecord) {
      console.error('Error creating startlist_import:', importError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de l\'import' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare entries to insert (matched + unmatched)
    const entriesToInsert = [
      ...matched.map((m: any) => ({
        startlist_id: importRecord.id,
        line_no: m.line_no,
        bib_no: null,
        source_name: m.source_name,
        source_team: m.team_code || null,
        coureur_id: m.coureur_id,
        confidence: m.confidence || 1.0,
        status: 'confirmed' as const,
      })),
      ...unmatched.map((u: any) => ({
        startlist_id: importRecord.id,
        line_no: u.line_no,
        bib_no: null,
        source_name: u.source_name,
        source_team: u.team_code || null,
        coureur_id: null,
        confidence: 0,
        status: 'unmatched' as const,
      }))
    ];

    // Insert entries into startlist_entries
    const { error: entriesError } = await supabase
      .from('startlist_entries')
      .insert(entriesToInsert);

    if (entriesError) {
      console.error('Error inserting entries:', entriesError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'insertion des entrées' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Saved ${entriesToInsert.length} entries to database (startlist_id: ${importRecord.id})`);

    const onRosterCount = matched.filter(m => m.on_roster).length;

    return new Response(
      JSON.stringify({
        startlist_id: importRecord.id,
        phase_id: phaseId,
        race_id: raceId,
        counts: {
          parsed: parsedEntries.length,
          matched_db: matched.length,
          on_roster: onRosterCount,
          without_owner: withoutOwner.length,
          unmatched: unmatched.length,
        },
        managers,
        without_owner: withoutOwner.sort((a: any, b: any) => a.nom.localeCompare(b.nom)),
        unmatched: unmatched.sort((a, b) => a.line_no - b.line_no),
        diagnostics: with_diagnostics ? diagnostics : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in startlist-parse-text:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
