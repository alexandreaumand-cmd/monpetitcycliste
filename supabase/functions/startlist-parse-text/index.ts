import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common name particles for multi-part last names
const PARTICLES = ['VAN', 'DE', 'DER', 'DEN', 'LA', 'LE', 'DU', 'DA', 'DI', 'DEL', 'DELLA', 'VON'];

// Character transliteration map
const CHAR_MAP: Record<string, string> = {
  'Ø': 'O', 'ø': 'o',
  'Æ': 'AE', 'æ': 'ae',
  'Å': 'A', 'å': 'a',
  'Ä': 'A', 'ä': 'a',
  'Ö': 'O', 'ö': 'o',
  'Ü': 'U', 'ü': 'u',
  'ß': 'ss',
  'Č': 'C', 'č': 'c',
  'Š': 'S', 'š': 's',
  'Ž': 'Z', 'ž': 'z',
  'Ł': 'L', 'ł': 'l',
};

// Advanced normalization with comprehensive special character handling
function normalizeText(text: string): string {
  if (!text) return '';
  
  let result = text;
  
  // 1. Explicit transliteration of European special characters
  for (const [char, replacement] of Object.entries(CHAR_MAP)) {
    result = result.replaceAll(char, replacement);
  }
  
  // 2. Remove all apostrophes and quotes (straight and typographic)
  result = result.replace(/['''`"""]/g, '');
  
  // 3. Remove parentheses and their content (e.g., "(ITA)")
  result = result.replace(/\([^)]*\)/g, '');
  
  // 4. Replace separators with space
  result = result.replace(/[-_/\.]/g, ' ');
  
  // 5. Normalize multi-spaces to single space
  result = result.replace(/\s+/g, ' ');
  
  // 6. Trim and uppercase
  return result.trim().toUpperCase();
}

// Extract tokens from normalized text (sorted for token-set comparison)
function extractTokens(normalized: string): string[] {
  return normalized.split(/\s+/).filter(t => t.length > 0).sort();
}

// Extract last name from normalized text
function extractLastName(normalized: string, includeParticles: boolean = false): string {
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return '';
  
  const lastName = tokens[tokens.length - 1];
  
  if (includeParticles && tokens.length > 1) {
    let particleCount = 0;
    for (let i = tokens.length - 2; i >= 0; i--) {
      if (PARTICLES.includes(tokens[i])) {
        particleCount++;
      } else {
        break;
      }
    }
    
    if (particleCount > 0) {
      return tokens.slice(tokens.length - 1 - particleCount).join('');
    }
  }
  
  return lastName;
}

// Invert name from "LAST First" to "First LAST"
function invertName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  
  const lastName = parts[0];
  const restOfName = parts.slice(1).join(' ');
  return `${restOfName} ${lastName}`;
}

// Optimized Levenshtein distance with early exit
function levenshtein(a: string, b: string, maxDistance: number = Infinity): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    let minInRow = Infinity;
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
      minInRow = Math.min(minInRow, matrix[i][j]);
    }
    if (minInRow > maxDistance) return maxDistance + 1;
  }
  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1)
function similarity(a: string, b: string): number {
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
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

    // Explicit authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Non authentifié. Votre session a peut-être expiré, veuillez vous reconnecter.',
          code: 'UNAUTHENTICATED'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.info('✅ Authenticated user:', user.id);

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
        
        parsedEntries.push({
          line_no: i + 1,
          source_team: teamCode,
          source_name: nameRaw,
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

    const aliasMap = new Map<string, Array<{ coureur_id: string; source_team: string | null }>>();
    if (aliases) {
      for (const a of aliases) {
        const key = normalizeText(a.alias_text);
        if (!aliasMap.has(key)) {
          aliasMap.set(key, []);
        }
        aliasMap.get(key)!.push({ coureur_id: a.coureur_id, source_team: a.source_team });
      }
    }

    // Build advanced dictionaries with name inversion support
    const mapFirstLast = new Map<string, string>();
    const mapLastFirst = new Map<string, string>();
    const mapTokenSet = new Map<string, string>();
    
    interface RiderData {
      id: string;
      nom: string;
      equipe: string | null;
      nomNorm: string;
      nomSwap: string;
      tokens: string[];
      tokenSetKey: string;
      lastName: string;
      lastNameAlt: string;
    }
    
    const riderDataMap = new Map<string, RiderData>();
    const tokenSetCount = new Map<string, number>();
    
    allCoureurs.forEach(rider => {
      const nomNorm = normalizeText(rider.nom);
      const nomSwap = normalizeText(invertName(rider.nom));
      const tokens = extractTokens(nomNorm);
      const tokenSetKey = tokens.join('|');
      const lastName = extractLastName(nomNorm);
      const lastNameAlt = extractLastName(nomNorm, true);
      
      riderDataMap.set(rider.id, {
        id: rider.id,
        nom: rider.nom,
        equipe: rider.equipe,
        nomNorm,
        nomSwap,
        tokens,
        tokenSetKey,
        lastName,
        lastNameAlt,
      });
      
      mapFirstLast.set(nomNorm, rider.id);
      mapLastFirst.set(nomSwap, rider.id);
      
      tokenSetCount.set(tokenSetKey, (tokenSetCount.get(tokenSetKey) || 0) + 1);
    });
    
    // Only add unique token sets to map
    riderDataMap.forEach((data, riderId) => {
      if (tokenSetCount.get(data.tokenSetKey) === 1) {
        mapTokenSet.set(data.tokenSetKey, riderId);
      }
    });

    console.log(`Built dictionaries: ${mapFirstLast.size} FirstLast, ${mapLastFirst.size} LastFirst, ${mapTokenSet.size} unique TokenSets`);

    // Match each entry - Enhanced multi-pass cascade
    const matched: any[] = [];
    const unmatched: any[] = [];
    let passAlias = 0, passExact = 0, passFuzzy = 0;

    for (const entry of parsedEntries) {
      const normalized = normalizeText(entry.source_name);
      const normalizedInverted = normalizeText(invertName(entry.source_name));
      const sourceTokens = extractTokens(normalized);
      const sourceTokenSetKey = sourceTokens.join('|');
      
      let isMatched = false;
      let coureurId = null;
      let confidence = 0;
      let matchMethod = '';

      // === PASS 1: Alias exact match (priority) - Test both variants ===
      let aliasMatches = aliasMap.get(normalized);
      if (!aliasMatches) aliasMatches = aliasMap.get(normalizedInverted);
      
      if (aliasMatches && aliasMatches.length > 0) {
        if (entry.source_team) {
          const teamMatch = aliasMatches.find(a => 
            a.source_team && normalizeText(a.source_team) === normalizeText(entry.source_team)
          );
          if (teamMatch) {
            coureurId = teamMatch.coureur_id;
            confidence = 1.0;
            isMatched = true;
            matchMethod = 'alias-team';
            passAlias++;
          }
        }
        if (!isMatched && aliasMatches.length === 1) {
          coureurId = aliasMatches[0].coureur_id;
          confidence = 0.95;
          isMatched = true;
          matchMethod = 'alias-unique';
          passAlias++;
        }
      }

      // === PASS 2: Exact map lookups (with name inversion support) ===
      if (!isMatched) {
        const lastFirstMatch = mapLastFirst.get(normalized) || mapLastFirst.get(normalizedInverted);
        const firstLastMatch = mapFirstLast.get(normalized) || mapFirstLast.get(normalizedInverted);
        const tokenSetMatch = mapTokenSet.get(sourceTokenSetKey);
        
        coureurId = lastFirstMatch || null;
        if (coureurId) {
          confidence = 0.98;
          isMatched = true;
          matchMethod = 'exact-lastfirst';
          passExact++;
        } else {
          coureurId = firstLastMatch || null;
          if (coureurId) {
            confidence = 0.98;
            isMatched = true;
            matchMethod = 'exact-firstlast';
            passExact++;
          } else {
            coureurId = tokenSetMatch || null;
            if (coureurId) {
              confidence = 0.96;
              isMatched = true;
              matchMethod = 'exact-tokenset';
              passExact++;
            }
          }
        }
      }

      // === PASS 3: Enhanced fuzzy matching ===
      if (!isMatched) {
        let bestScore = 0;
        let bestId = null;
        
        for (const [riderId, riderData] of riderDataMap) {
          const score1 = similarity(normalized, riderData.nomNorm);
          const score2 = similarity(normalized, riderData.nomSwap);
          const bestRiderScore = Math.max(score1, score2);
          
          if (bestRiderScore >= 0.85 && bestRiderScore > bestScore) {
            bestScore = bestRiderScore;
            bestId = riderId;
          }
        }
        
        if (bestId && bestScore >= 0.85) {
          coureurId = bestId;
          confidence = bestScore;
          isMatched = true;
          matchMethod = 'fuzzy';
          passFuzzy++;
        }
      }

      if (isMatched && coureurId) {
        const riderData = riderDataMap.get(coureurId)!;
        const onRoster = rostersByRider.has(coureurId);
        
        matched.push({
          ...entry,
          coureur_id: coureurId,
          nom: riderData.nom,
          equipe: riderData.equipe,
          confidence: confidence,
          match_type: matchMethod,
          on_roster: onRoster,
        });

        if (with_diagnostics) {
          diagnostics.push({
            line_no: entry.line_no,
            team_code: entry.source_team,
            name_raw: entry.source_name,
            normalized: normalized,
            match_type: matchMethod,
            score: confidence,
            db_nom: riderData.nom,
            db_equipe: riderData.equipe,
            on_roster: onRoster,
          });
        }
      } else {
        // Get suggestions
        const suggestions = Array.from(riderDataMap.values())
          .map(r => {
            const score1 = similarity(normalized, r.nomNorm);
            const score2 = similarity(normalized, r.nomSwap);
            const score = Math.max(score1, score2);
            return {
              coureur_id: r.id,
              nom: r.nom,
              equipe: r.equipe,
              score,
              on_roster: rostersByRider.has(r.id),
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
            team_code: entry.source_team,
            name_raw: entry.source_name,
            normalized: normalized,
            match_type: 'none',
          });
        }
      }
    }

    console.log(`✅ Matching complete: ${matched.length} matched, ${unmatched.length} unmatched (Alias: ${passAlias}, Exact: ${passExact}, Fuzzy: ${passFuzzy})`);

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
      console.error('❌ Error creating startlist_import:', {
        error: importError,
        message: importError?.message,
        code: importError?.code,
        details: importError?.details,
        hint: importError?.hint
      });
      return new Response(
        JSON.stringify({ 
          error: `Erreur lors de la création de l'import: ${importError?.message || 'Unknown'}`,
          details: importError?.details,
          code: importError?.code
        }),
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
      console.error('❌ Error inserting entries:', {
        error: entriesError,
        message: entriesError?.message,
        code: entriesError?.code,
        details: entriesError?.details,
        hint: entriesError?.hint
      });
      return new Response(
        JSON.stringify({ 
          error: `Erreur lors de l'insertion des entrées: ${entriesError?.message || 'Unknown'}`,
          details: entriesError?.details,
          code: entriesError?.code
        }),
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
