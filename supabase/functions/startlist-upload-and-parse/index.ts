import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize text for matching
function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[-\.]/g, ' ') // Replace - and . with space
    .trim()
    .toUpperCase();
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

    const { race_id: raceId, text_content: textContent } = await req.json();

    if (!raceId || !textContent) {
      return new Response(
        JSON.stringify({ error: 'race_id et text_content sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get race info
    const { data: race, error: raceError } = await supabase
      .from('courses')
      .select('id, nom, date_debut, phase_id, categorie')
      .eq('id', raceId)
      .single();

    if (raceError || !race) {
      return new Response(
        JSON.stringify({ error: 'Course non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get manager ID
    const { data: { user } } = await supabase.auth.getUser();
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    // Parse lines from text
    const lines = textContent.split('\n').filter((line: string) => line.trim());
    const parsedEntries: any[] = [];
    
    // Regex patterns for parsing
    const patterns = [
      // NEW: BIB. TEAM_CODE LASTNAME Firstname TIME (e.g., "0. MBH NESPOLI Lorenzo 0:00")
      {
        regex: /^(\d+)\.\s+([A-Z]{3})\s+([A-Z\s\-\.\']+)\s+\d+:\d+/i,
        extract: (match: RegExpMatchArray) => ({
          bib_no: match[1],
          source_team: match[2],
          source_name: match[3].trim(), // Keep LASTNAME Firstname as-is for now
        })
      },
      // BIB NAME TEAM
      {
        regex: /^(\d+)\s+([A-Z\s\-\.\']+)\s+([A-Z\s\-\.]+)$/i,
        extract: (match: RegExpMatchArray) => ({
          bib_no: match[1],
          source_name: match[2].trim(),
          source_team: match[3].trim(),
        })
      },
      // NAME TEAM
      {
        regex: /^([A-Z\s\-\.\']+)\s+([A-Z\s\-\.]+)$/i,
        extract: (match: RegExpMatchArray) => ({
          bib_no: null,
          source_name: match[1].trim(),
          source_team: match[2].trim(),
        })
      },
      // BIB NAME
      {
        regex: /^(\d+)\s+([A-Z\s\-\.\']+)$/i,
        extract: (match: RegExpMatchArray) => ({
          bib_no: match[1],
          source_name: match[2].trim(),
          source_team: null,
        })
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let parsed = false;
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const entry = pattern.extract(match);
          parsedEntries.push({
            line_no: i + 1,
            ...entry,
          });
          console.log(`Parsed entry #${i+1}: bib=${entry.bib_no}, team=${entry.source_team}, name=${entry.source_name}`);
          parsed = true;
          break;
        }
      }

      if (!parsed && line.length > 3) {
        // Fallback: treat entire line as name
        parsedEntries.push({
          line_no: i + 1,
          bib_no: null,
          source_name: line.trim(),
          source_team: null,
        });
        console.log(`Fallback parse #${i+1}: name=${line.trim()}`);
      }
    }

    // Load name aliases
    const { data: aliases } = await supabase
      .from('name_aliases')
      .select('alias_text, coureur_id, source_team');

    const aliasMap = new Map<string, { coureur_id: string; source_team: string | null }[]>();
    aliases?.forEach(alias => {
      const key = normalizeText(alias.alias_text);
      if (!aliasMap.has(key)) {
        aliasMap.set(key, []);
      }
      aliasMap.get(key)!.push({
        coureur_id: alias.coureur_id,
        source_team: alias.source_team
      });
    });

    // Load all riders
    const { data: riders } = await supabase
      .from('coureurs')
      .select('id, nom, equipe');

    // Match each entry
    const matchedEntries: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const entry of parsedEntries) {
      const normalized = normalizeText(entry.source_name);
      let matched = false;
      let coureurId = null;
      let confidence = 0;

      // 1. Check aliases first
      const aliasMatches = aliasMap.get(normalized);
      if (aliasMatches && aliasMatches.length > 0) {
        // If source_team matches, prefer that alias
        if (entry.source_team) {
          const teamMatch = aliasMatches.find(a => 
            a.source_team && normalizeText(a.source_team) === normalizeText(entry.source_team)
          );
          if (teamMatch) {
            coureurId = teamMatch.coureur_id;
            confidence = 1.0;
            matched = true;
          }
        }
        if (!matched && aliasMatches.length === 1) {
          coureurId = aliasMatches[0].coureur_id;
          confidence = 0.95;
          matched = true;
        }
      }

      // 2. Direct match on riders
      if (!matched && riders) {
        for (const rider of riders) {
          const riderNorm = normalizeText(rider.nom);
          
          // Exact match
          if (riderNorm === normalized) {
            coureurId = rider.id;
            confidence = 0.98;
            matched = true;
            break;
          }

          // Swapped name (LAST FIRST <-> FIRST LAST)
          const parts = normalized.split(' ');
          if (parts.length >= 2) {
            // Try multiple swap combinations for multi-part names
            const swapped = `${parts[parts.length - 1]} ${parts.slice(0, parts.length - 1).join(' ')}`;
            if (riderNorm === swapped) {
              coureurId = rider.id;
              confidence = 0.95;
              matched = true;
              break;
            }
            
            // Also try first-last swap for 2-part names
            if (parts.length === 2) {
              const simpleSwap = `${parts[1]} ${parts[0]}`;
              if (riderNorm === simpleSwap) {
                coureurId = rider.id;
                confidence = 0.95;
                matched = true;
                break;
              }
            }
          }
        }
      }

      // 3. Fuzzy match (test both name orders)
      if (!matched && riders) {
        let bestMatch = null;
        let bestScore = 0;

        const parts = normalized.split(' ');
        const namesToTest = [normalized];
        
        // Add swapped version for fuzzy matching
        if (parts.length >= 2) {
          const swapped = `${parts[parts.length - 1]} ${parts.slice(0, parts.length - 1).join(' ')}`;
          namesToTest.push(swapped);
          if (parts.length === 2) {
            const simpleSwap = `${parts[1]} ${parts[0]}`;
            if (simpleSwap !== swapped) {
              namesToTest.push(simpleSwap);
            }
          }
        }

        for (const rider of riders) {
          const riderNorm = normalizeText(rider.nom);
          
          // Test all name variations
          for (const testName of namesToTest) {
            let score = similarity(testName, riderNorm);
            
            // Bonus if team matches
            if (entry.source_team && rider.equipe) {
              const teamSimilarity = similarity(
                normalizeText(entry.source_team),
                normalizeText(rider.equipe)
              );
              if (teamSimilarity > 0.7) {
                score += 0.1;
              }
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = rider.id;
            }
          }
        }

        // Lower threshold to 0.80 for auto-confirmation
        if (bestMatch && bestScore >= 0.80) {
          coureurId = bestMatch;
          confidence = Math.min(bestScore, 0.99); // Cap at 0.99
          matched = true;
        }
      }

      if (matched) {
        matchedCount++;
        console.log(`✓ Matched #${entry.line_no}: ${entry.source_name} → ${coureurId} (confidence: ${confidence.toFixed(2)})`);
      } else {
        unmatchedCount++;
        console.log(`✗ Unmatched #${entry.line_no}: ${entry.source_name}`);
      }

      matchedEntries.push({
        ...entry,
        coureur_id: coureurId,
        confidence: confidence,
        status: matched ? 'confirmed' : 'unmatched'
      });
    }

    // Create startlist_import
    const { data: importRecord, error: importError } = await supabase
      .from('startlist_imports')
      .insert({
        race_id: raceId,
        created_by_manager_id: manager?.id,
        raw_text: textContent,
      })
      .select()
      .single();

    if (importError || !importRecord) {
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de l\'import' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert entries
    const entriesToInsert = matchedEntries.map(e => ({
      startlist_id: importRecord.id,
      line_no: e.line_no,
      bib_no: e.bib_no,
      source_name: e.source_name,
      source_team: e.source_team,
      coureur_id: e.coureur_id,
      confidence: e.confidence,
      status: e.status,
    }));

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

    console.log(`\n=== STARTLIST PARSING COMPLETE ===`);
    console.log(`Total lines: ${lines.length}`);
    console.log(`Parsed: ${parsedEntries.length}`);
    console.log(`Matched: ${matchedCount} (${(matchedCount/parsedEntries.length*100).toFixed(1)}%)`);
    console.log(`Unmatched: ${unmatchedCount} (${(unmatchedCount/parsedEntries.length*100).toFixed(1)}%)`);
    console.log(`Auto-confirmed: ${matchedEntries.filter(e => e.status === 'confirmed').length}`);
    
    return new Response(
      JSON.stringify({
        startlist_id: importRecord.id,
        race: {
          id: race.id,
          nom: race.nom,
          date_debut: race.date_debut,
          phase_id: race.phase_id,
        },
        counts: {
          parsed: parsedEntries.length,
          matched: matchedCount,
          unmatched: unmatchedCount,
        },
        sample: matchedEntries.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in startlist-upload-and-parse:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
