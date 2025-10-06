import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UCI team code to full name mapping
const UCI_TEAM_MAP: Record<string, string> = {
  'UAD': 'UAE TEAM EMIRATES',
  'IGD': 'INEOS GRENADIERS',
  'SOQ': 'SOUDAL QUICK STEP',
  'TVL': 'TEAM VISMA LEASE A BIKE',
  'DAT': 'DECATHLON AG2R LA MONDIALE TEAM',
  'BBH': 'BURGOS BH',
  'MOV': 'MOVISTAR TEAM',
  'TBV': 'BAHRAIN VICTORIOUS',
  'JAY': 'TEAM JAYCO ALULA',
  'XAT': 'TUDOR PRO CYCLING TEAM',
  'IPT': 'ISRAEL PREMIER TECH',
  'BOH': 'BORA HANSGROHE',
  'COF': 'COFIDIS',
  'GFC': 'GROUPAMA FDJ',
  'EFE': 'EF EDUCATION EASYPOST',
  'TFS': 'TREK SEGAFREDO',
  'AST': 'ASTANA QAZAQSTAN TEAM',
  'LTD': 'LIDL TREK',
  'DSM': 'TEAM DSM FIRMENICH POSTNL',
  'ARK': 'ARKEA B&B HOTELS',
  'UXT': 'UNO X MOBILITY',
  'MBH': 'MOVISTAR TEAM',
  'TNN': 'TEAM NOVO NORDISK',
  'BWB': 'BINGOAL WB',
  'IWG': 'INTERMARCHE WANTY',
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

// Invert name from "LAST First" to "First LAST"
function invertName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  
  // For 2 parts: "LAST First" → "First LAST"
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  
  // For 3+ parts: "LAST First Middle" → "First Middle LAST"
  const lastName = parts[0];
  const restOfName = parts.slice(1).join(' ');
  return `${restOfName} ${lastName}`;
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

    // Build in-memory dictionaries for O(1) lookups
    const mapFirstLast = new Map<string, string>(); // "Firstname LASTNAME" → coureur_id
    const mapLastFirst = new Map<string, string>(); // "LASTNAME Firstname" → coureur_id
    
    riders?.forEach(rider => {
      const normalized = normalizeText(rider.nom);
      mapFirstLast.set(normalized, rider.id);
      
      // Generate inverted version
      const inverted = normalizeText(invertName(rider.nom));
      mapLastFirst.set(inverted, rider.id);
    });

    console.log(`Built dictionaries: ${mapFirstLast.size} FirstLast entries, ${mapLastFirst.size} LastFirst entries`);

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

      // 2. Exact map lookup (O(1))
      if (!matched) {
        // Try LastFirst lookup first (common in startlists)
        coureurId = mapLastFirst.get(normalized) || null;
        if (coureurId) {
          confidence = 0.98;
          matched = true;
          console.log(`  → Exact LastFirst match: ${normalized}`);
        } else {
          // Try FirstLast lookup
          coureurId = mapFirstLast.get(normalized) || null;
          if (coureurId) {
            confidence = 0.98;
            matched = true;
            console.log(`  → Exact FirstLast match: ${normalized}`);
          }
        }
      }

      // 3. Fuzzy match (test both name orders)
      if (!matched && riders) {
        let bestMatch = null;
        let bestScore = 0;
        let bestRiderName = '';
        let bestTeamBonus = 0;

        const namesToTest = [normalized];
        
        // Add inverted version for fuzzy matching
        const inverted = normalizeText(invertName(entry.source_name));
        if (inverted !== normalized) {
          namesToTest.push(inverted);
        }

        // Map UCI team code to full name for better team matching
        const sourceTeamNorm = entry.source_team 
          ? normalizeText(UCI_TEAM_MAP[entry.source_team] || entry.source_team)
          : null;

        for (const rider of riders) {
          const riderNorm = normalizeText(rider.nom);
          
          // Test all name variations
          for (const testName of namesToTest) {
            let score = similarity(testName, riderNorm);
            let teamBonus = 0;
            
            // Enhanced team bonus with UCI mapping
            if (sourceTeamNorm && rider.equipe) {
              const riderTeamNorm = normalizeText(rider.equipe);
              const teamSimilarity = similarity(sourceTeamNorm, riderTeamNorm);
              
              if (teamSimilarity > 0.7) {
                teamBonus = 0.15; // Stronger bonus for good team match
                score += teamBonus;
              }
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = rider.id;
              bestRiderName = rider.nom;
              bestTeamBonus = teamBonus;
            }
          }
        }

        // Dynamic threshold: 0.75 if team code present and mapped, 0.80 otherwise
        const threshold = (entry.source_team && UCI_TEAM_MAP[entry.source_team]) ? 0.75 : 0.80;
        
        if (bestMatch && bestScore >= threshold) {
          coureurId = bestMatch;
          confidence = Math.min(bestScore, 0.99); // Cap at 0.99
          matched = true;
          console.log(`  → Fuzzy match: ${entry.source_name} → ${bestRiderName} (score: ${bestScore.toFixed(2)}, team bonus: ${bestTeamBonus.toFixed(2)})`);
        } else if (bestMatch) {
          // Log near-misses for debugging
          console.log(`  ✗ Near-miss: ${entry.source_name} → ${bestRiderName} (score: ${bestScore.toFixed(2)}, threshold: ${threshold}, team bonus: ${bestTeamBonus.toFixed(2)})`);
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
