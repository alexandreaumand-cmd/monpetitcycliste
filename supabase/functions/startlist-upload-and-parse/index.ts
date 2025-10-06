import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UCI team code to full name mapping (2024-2025 WT + ProTeams)
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
  'TUD': 'TUDOR PRO CYCLING TEAM',
  'IPT': 'ISRAEL PREMIER TECH',
  'BOH': 'BORA HANSGROHE',
  'RBH': 'RED BULL BORA HANSGROHE',
  'COF': 'COFIDIS',
  'GFC': 'GROUPAMA FDJ',
  'EFE': 'EF EDUCATION EASYPOST',
  'TFS': 'TREK SEGAFREDO',
  'AST': 'ASTANA QAZAQSTAN TEAM',
  'LTD': 'LIDL TREK',
  'DSM': 'TEAM DSM FIRMENICH POSTNL',
  'DFP': 'TEAM DSM FIRMENICH POSTNL',
  'ARK': 'ARKEA B&B HOTELS',
  'UXT': 'UNO X MOBILITY',
  'MBH': 'MOVISTAR TEAM',
  'TNN': 'TEAM NOVO NORDISK',
  'BWB': 'BINGOAL WB',
  'IWG': 'INTERMARCHE WANTY',
  'ADC': 'ALPECIN DECEUNINCK',
  'LTS': 'LOTTO DSTNY',
  'TEN': 'TEAM CORRATEC VINI FANTINI',
  'QST': 'SOUDAL QUICK STEP',
};

// Common name particles for smart lastName extraction
const PARTICLES = ['VAN', 'DER', 'DE', 'DI', 'DA', 'DEL', 'DELLA', 'DELLE', 'VON', 'ZU', 'ZUM', 'ZUR', 'LA', 'LE', 'LES', 'DU', 'DES', 'AL', 'EL', 'MC', 'MAC', 'O', 'D'];

// Character transliteration map for European special characters
const CHAR_MAP: Record<string, string> = {
  'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ã': 'A', 'Å': 'A', 'Ā': 'A',
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a', 'ā': 'a',
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Ē': 'E', 'Ė': 'E', 'Ę': 'E',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ė': 'e', 'ę': 'e',
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I', 'Ī': 'I', 'Į': 'I',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'į': 'i',
  'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O', 'Õ': 'O', 'Ø': 'O', 'Ō': 'O',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ø': 'o', 'ō': 'o',
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U', 'Ū': 'U', 'Ų': 'U',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ų': 'u',
  'Ñ': 'N', 'Ń': 'N', 'Ň': 'N',
  'ñ': 'n', 'ń': 'n', 'ň': 'n',
  'Ç': 'C', 'Ć': 'C', 'Č': 'C',
  'ç': 'c', 'ć': 'c', 'č': 'c',
  'Ś': 'S', 'Š': 'S', 'Ş': 'S',
  'ś': 's', 'š': 's', 'ş': 's',
  'Ł': 'L', 'Ľ': 'L',
  'ł': 'l', 'ľ': 'l',
  'Ž': 'Z', 'Ź': 'Z', 'Ż': 'Z',
  'ž': 'z', 'ź': 'z', 'ż': 'z',
  'Đ': 'D', 'Ď': 'D',
  'đ': 'd', 'ď': 'd',
  'Ř': 'R', 'ř': 'r',
  'Ý': 'Y', 'Ÿ': 'Y',
  'ý': 'y', 'ÿ': 'y',
  'Æ': 'AE', 'æ': 'ae',
  'Œ': 'OE', 'œ': 'oe',
  'ß': 'SS',
};

// Advanced normalization with comprehensive special character handling
function normalizeTextAdvanced(text: string): string {
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

// Legacy normalization (kept for compatibility)
function normalizeText(text: string): string {
  return normalizeTextAdvanced(text);
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
    // Check if previous token(s) are particles
    let particleCount = 0;
    for (let i = tokens.length - 2; i >= 0; i--) {
      if (PARTICLES.includes(tokens[i])) {
        particleCount++;
      } else {
        break;
      }
    }
    
    if (particleCount > 0) {
      // Join particles with last name (e.g., "VAN DER POEL" -> "VANDERPOEL")
      return tokens.slice(tokens.length - 1 - particleCount).join('');
    }
  }
  
  return lastName;
}

// Generate team acronym from full name
function generateTeamAcronym(teamName: string): string {
  if (!teamName) return '';
  const words = teamName.split(/\s+/).filter(w => w.length > 0);
  return words.map(w => w[0]).join('');
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
    // Early exit if all values in row exceed maxDistance
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
  console.log('[DEPLOY] startlist-upload-and-parse v2025-10-06-01 STARTING');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[DEPLOY] Handler reached, creating Supabase client');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { race_id: raceId, text_content: textContent } = await req.json();

    if (!raceId || !textContent) {
      return new Response(
        JSON.stringify({ error: 'race_id et text_content sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permission check: admin OR creator of latest import for this race
    const { data: isAdminData } = await supabase.rpc('is_admin');
    
    // Get current manager
    const { data: { user } } = await supabase.auth.getUser();
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user?.id)
      .maybeSingle();

    let allowed = !!isAdminData;

    // If not admin, check if user is the creator of the latest import for this race
    if (!allowed && manager) {
      const { data: latestImport } = await supabase
        .from('startlist_imports')
        .select('id, created_by_manager_id')
        .eq('race_id', raceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestImport && latestImport.created_by_manager_id === manager.id) {
        allowed = true;
      }
    }

    if (!allowed) {
      console.error('[startlist-upload-and-parse] Access denied for user:', user?.id);
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé à l\'admin ou au créateur de la startlist' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.log('[DEPLOY] Aliases loaded:', (aliases || []).length, 'entries');
    console.log('[DEBUG] Loaded', (aliases || []).length, 'name aliases');

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

    console.log('[DEBUG] Building rider maps from', riders?.length || 0, 'coureurs');
    
    // Build in-memory dictionaries with advanced pre-calculations
    const mapFirstLast = new Map<string, string>(); // "Firstname LASTNAME" → coureur_id
    const mapLastFirst = new Map<string, string>(); // "LASTNAME Firstname" → coureur_id
    const mapTokenSet = new Map<string, string>(); // "tokenSetKey" → coureur_id (if unique)
    
    interface RiderData {
      id: string;
      nom: string;
      equipe: string | null;
      nomNorm: string;
      nomSwap: string;
      tokens: string[];
      tokenSetKey: string;
      lastName: string;
      lastNameAlt: string; // without particles
      teamNorm: string;
      teamAcronym: string;
    }
    
    const riderDataMap = new Map<string, RiderData>();
    const tokenSetCount = new Map<string, number>(); // Track duplicates
    
    riders?.forEach(rider => {
      const nomNorm = normalizeText(rider.nom);
      const nomSwap = normalizeText(invertName(rider.nom));
      const tokens = extractTokens(nomNorm);
      const tokenSetKey = tokens.join('|');
      const lastName = extractLastName(nomNorm);
      const lastNameAlt = extractLastName(nomNorm, true); // with particles joined
      const teamNorm = normalizeText(rider.equipe || '');
      const teamAcronym = generateTeamAcronym(teamNorm);
      
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
        teamNorm,
        teamAcronym,
      });
      
      mapFirstLast.set(nomNorm, rider.id);
      mapLastFirst.set(nomSwap, rider.id);
      
      // DEBUG: Log for specific riders
      if (rider.id === 'matteo_trentin' || rider.id === 'joel_suter' || rider.id === 'fabian_weiss') {
        console.log(`[DEBUG] Mapping rider ${rider.id}:`, {
          original: rider.nom,
          nomNorm,
          nomSwap,
          mapFirstLastKey: nomNorm,
          mapLastFirstKey: nomSwap
        });
      }
      
      // Count token set occurrences
      tokenSetCount.set(tokenSetKey, (tokenSetCount.get(tokenSetKey) || 0) + 1);
    });
    
    // Only add unique token sets to map
    riderDataMap.forEach((data, riderId) => {
      if (tokenSetCount.get(data.tokenSetKey) === 1) {
        mapTokenSet.set(data.tokenSetKey, riderId);
      }
    });

    // Build search indexes for optimized matching
    const lastNameIndex = new Map<string, Set<string>>(); // lastName -> Set<riderId>
    const lastNameJoinedIndex = new Map<string, Set<string>>(); // lastNameAlt -> Set<riderId>
    const tokenIndex = new Map<string, Set<string>>(); // token -> Set<riderId>
    
    riderDataMap.forEach((data, riderId) => {
      // Index by last name
      if (!lastNameIndex.has(data.lastName)) {
        lastNameIndex.set(data.lastName, new Set());
      }
      lastNameIndex.get(data.lastName)!.add(riderId);
      
      // Index by joined last name (with particles)
      if (data.lastNameAlt && data.lastNameAlt !== data.lastName) {
        if (!lastNameJoinedIndex.has(data.lastNameAlt)) {
          lastNameJoinedIndex.set(data.lastNameAlt, new Set());
        }
        lastNameJoinedIndex.get(data.lastNameAlt)!.add(riderId);
      }
      
      // Index by tokens
      data.tokens.forEach(token => {
        if (!tokenIndex.has(token)) {
          tokenIndex.set(token, new Set());
        }
        tokenIndex.get(token)!.add(riderId);
      });
    });

    console.log(`Built dictionaries: ${mapFirstLast.size} FirstLast, ${mapLastFirst.size} LastFirst, ${mapTokenSet.size} unique TokenSets`);
    console.log(`Built indexes: ${lastNameIndex.size} lastNames, ${lastNameJoinedIndex.size} joinedNames, ${tokenIndex.size} tokens`);

    // Match each entry - Enhanced multi-pass cascade with dual-variant processing
    const matchedEntries: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    const nearMisses: any[] = [];
    
    // Pass-level counters for logging
    let passAlias = 0, passExact = 0, passLastInit = 0, passTokenSet = 0, passFuzzy = 0;

    for (const entry of parsedEntries) {
      const normalized = normalizeText(entry.source_name);
      const normalizedInverted = normalizeText(invertName(entry.source_name));
      const sourceTokens = extractTokens(normalized);
      const sourceTokenSetKey = sourceTokens.join('|');
      
      // DEBUG: Log for specific names
      const isDebugName = entry.source_name.includes('TRENTIN') || entry.source_name.includes('SUTER') || entry.source_name.includes('WEISS');
      if (isDebugName) {
        console.log(`\n[DEBUG] Processing entry #${entry.line_no}:`, {
          source_name: entry.source_name,
          normalized,
          normalizedInverted,
          sourceTokens,
          sourceTokenSetKey
        });
      }
      
      // Extract potential last names from both variants and first token
      const sourceLastNamesSet = new Set<string>();
      const tokensNormalized = normalized.split(/\s+/).filter(t => t.length > 0);
      
      // Add first token (covers "LASTNAME Firstname" format)
      if (tokensNormalized.length > 0 && tokensNormalized[0].length > 0) {
        sourceLastNamesSet.add(tokensNormalized[0]);
      }
      
      // Add last token from both variants
      const lastNorm = extractLastName(normalized);
      if (lastNorm.length > 0) sourceLastNamesSet.add(lastNorm);
      
      const lastInv = extractLastName(normalizedInverted);
      if (lastInv.length > 0) sourceLastNamesSet.add(lastInv);
      
      const sourceLastNames = Array.from(sourceLastNamesSet);
      
      // Extract potential first initials from both variants
      const sourceFirstInitials = new Set<string>();
      const tokensNorm = normalized.split(/\s+/).filter(t => t.length > 0);
      const tokensInv = normalizedInverted.split(/\s+/).filter(t => t.length > 0);
      if (tokensNorm.length >= 2) sourceFirstInitials.add(tokensNorm[1].charAt(0));
      if (tokensInv.length >= 1) sourceFirstInitials.add(tokensInv[0].charAt(0));
      
      let matched = false;
      let coureurId = null;
      let confidence = 0;
      let matchMethod = '';

      // Map UCI team code to full name for better team matching
      const sourceTeamNorm = entry.source_team 
        ? normalizeText(UCI_TEAM_MAP[entry.source_team] || entry.source_team)
        : '';
      const sourceTeamAcronym = generateTeamAcronym(sourceTeamNorm);

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
            matched = true;
            matchMethod = 'alias-team';
            passAlias++;
          }
        }
        if (!matched && aliasMatches.length === 1) {
          coureurId = aliasMatches[0].coureur_id;
          confidence = 0.95;
          matched = true;
          matchMethod = 'alias-unique';
          passAlias++;
        }
      }

      // === PASS 2: Exact map lookups ===
      if (!matched) {
        const lastFirstMatch = mapLastFirst.get(normalized);
        const firstLastMatch = mapFirstLast.get(normalized);
        const tokenSetMatch = mapTokenSet.get(sourceTokenSetKey);
        
        if (isDebugName) {
          console.log(`[DEBUG] Pass2 checks for ${entry.source_name}:`, {
            normalized,
            lastFirstMatch,
            firstLastMatch,
            tokenSetMatch,
            'mapLastFirst.has(normalized)': mapLastFirst.has(normalized),
            'mapFirstLast.has(normalized)': mapFirstLast.has(normalized),
            'mapTokenSet.has(sourceTokenSetKey)': mapTokenSet.has(sourceTokenSetKey)
          });
          
          // Show sample of similar keys in mapLastFirst
          const lastName = entry.source_name.split(' ')[0];
          const relevantKeys = Array.from(mapLastFirst.keys()).filter(k => k.includes(lastName.toUpperCase())).slice(0, 3);
          console.log(`[DEBUG] Sample mapLastFirst keys containing "${lastName}":`, relevantKeys);
        }
        
        coureurId = lastFirstMatch || null;
        if (coureurId) {
          confidence = 0.98;
          matched = true;
          matchMethod = 'exact-lastfirst';
          passExact++;
          
          if (isDebugName) {
            console.log(`[DEBUG] ✅ Pass2 MATCHED via lastfirst: ${entry.source_name} -> ${coureurId}`);
          }
        } else {
          coureurId = firstLastMatch || null;
          if (coureurId) {
            confidence = 0.98;
            matched = true;
            matchMethod = 'exact-firstlast';
            passExact++;
            
            if (isDebugName) {
              console.log(`[DEBUG] ✅ Pass2 MATCHED via firstlast: ${entry.source_name} -> ${coureurId}`);
            }
          } else {
            coureurId = tokenSetMatch || null;
            if (coureurId) {
              confidence = 0.96;
              matched = true;
              matchMethod = 'exact-tokenset';
              passExact++;
              
              if (isDebugName) {
                console.log(`[DEBUG] ✅ Pass2 MATCHED via tokenset: ${entry.source_name} -> ${coureurId}`);
              }
            }
          }
        }
        
        if (!matched && isDebugName) {
          console.log(`[DEBUG] ❌ Pass2 NO MATCH for ${entry.source_name}`);
        }
      }

      // === PASS 3: Last name + Initial match (optimized with index) ===
      if (!matched && sourceLastNames.length > 0 && sourceFirstInitials.size > 0) {
        // Get candidates from indexes for all potential last names
        const candidates = new Set<string>();
        for (const lastName of sourceLastNames) {
          const byLastName = lastNameIndex.get(lastName);
          const byJoinedName = lastNameJoinedIndex.get(lastName);
          if (byLastName) byLastName.forEach(id => candidates.add(id));
          if (byJoinedName) byJoinedName.forEach(id => candidates.add(id));
        }
        
        // Only search through candidates (typically 1-5 riders instead of 2000+)
        for (const riderId of candidates) {
          const riderData = riderDataMap.get(riderId)!;
          const riderFirstInitial = riderData.tokens[0]?.charAt(0) || '';
          
          if (sourceFirstInitials.has(riderFirstInitial)) {
            // Calculate team similarity only if we have a team
            const teamSim = sourceTeamNorm ? similarity(sourceTeamNorm, riderData.teamNorm) : 0;
            const acronymMatch = sourceTeamAcronym && riderData.teamAcronym && 
                                similarity(sourceTeamAcronym, riderData.teamAcronym) > 0.75;
            
            if (teamSim > 0.75 || acronymMatch) {
              coureurId = riderId;
              confidence = 0.96;
              matched = true;
              matchMethod = 'lastname-initial-team';
              passLastInit++;
              break; // High confidence match, exit immediately
            } else if (teamSim > 0.5 || !sourceTeamNorm) {
              coureurId = riderId;
              confidence = 0.90;
              matched = true;
              matchMethod = 'lastname-initial';
              passLastInit++;
              break; // Good enough match, exit
            }
          }
        }
      }

      // === PASS 4: Token-set weighted matching (optimized with pre-filtering) ===
      if (!matched) {
        // Build candidate set from token index (much smaller search space)
        const candidates = new Set<string>();
        sourceTokens.forEach(token => {
          const byToken = tokenIndex.get(token);
          if (byToken) byToken.forEach(id => candidates.add(id));
        });
        
        // Limit to top 150 candidates if list is large
        let candidateList = Array.from(candidates);
        if (candidateList.length > 150) {
          // Pre-score by token count and keep top 150
          const tokenCounts = new Map<string, number>();
          candidateList.forEach(riderId => {
            const riderData = riderDataMap.get(riderId)!;
            const commonTokens = sourceTokens.filter(t => riderData.tokens.includes(t)).length;
            tokenCounts.set(riderId, commonTokens);
          });
          candidateList = candidateList
            .sort((a, b) => (tokenCounts.get(b) || 0) - (tokenCounts.get(a) || 0))
            .slice(0, 150);
        }
        
        let bestMatch = null;
        let bestScore = 0;
        let bestRiderName = '';
        let bestDetails = { method: '', teamBonus: 0, lastNameBoost: 0 };
        const teamSimCache = new Map<string, number>(); // Cache team similarity
        
        const sourceTokensSet = new Set(sourceTokens);
        
        for (const riderId of candidateList) {
          const riderData = riderDataMap.get(riderId)!;
          const riderTokensSet = new Set(riderData.tokens);
          const intersection = [...sourceTokensSet].filter(t => riderTokensSet.has(t));
          
          const scoreTokens = intersection.length / Math.max(sourceTokensSet.size, riderTokensSet.size);
          const scoreFull = similarity(normalized, riderData.nomNorm);
          let score = 0.6 * scoreTokens + 0.4 * scoreFull;
          
          let teamBonus = 0;
          let lastNameBoost = 0;
          
          if (sourceTeamNorm) {
            // Use cached team similarity
            if (!teamSimCache.has(riderId)) {
              teamSimCache.set(riderId, similarity(sourceTeamNorm, riderData.teamNorm));
            }
            const teamSim = teamSimCache.get(riderId)!;
            const acronymSim = sourceTeamAcronym && riderData.teamAcronym 
              ? similarity(sourceTeamAcronym, riderData.teamAcronym)
              : 0;
            
            if (teamSim > 0.75) {
              teamBonus = 0.15;
              score += teamBonus;
            } else if (teamSim > 0.60) {
              teamBonus = 0.08;
              score += teamBonus;
            } else if (acronymSim > 0.75) {
              teamBonus = 0.05;
              score += teamBonus;
            }
          }
          
          // Check if rider's last name matches any source last name
          const hasLastNameMatch = sourceLastNames.some(ln => 
            riderData.lastName === ln || riderData.lastNameAlt === ln
          );
          if (hasLastNameMatch) {
            lastNameBoost = 0.10;
            score += lastNameBoost;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = riderId;
            bestRiderName = riderData.nom;
            bestDetails = { method: 'token-set', teamBonus, lastNameBoost };
          }
        }
        
        let threshold = 0.82;
        const scoreTokens = bestScore - bestDetails.teamBonus - bestDetails.lastNameBoost;
        
        if (bestDetails.lastNameBoost > 0 && bestDetails.teamBonus >= 0.08) {
          threshold = 0.65;
        } else if (scoreTokens >= 0.95) {
          // Perfect token match - lower threshold significantly
          threshold = 0.70;
        } else if (bestDetails.teamBonus >= 0.05 || entry.source_team) {
          threshold = 0.75;
        }
        
        if (bestMatch && bestScore >= threshold) {
          coureurId = bestMatch;
          confidence = Math.min(bestScore, 0.99);
          matched = true;
          matchMethod = bestDetails.method;
          passTokenSet++;
        } else if (bestMatch && bestScore >= 0.70) {
          nearMisses.push({
            entry: entry.source_name,
            candidate: bestRiderName,
            score: bestScore,
            threshold,
            teamBonus: bestDetails.teamBonus,
            lastNameBoost: bestDetails.lastNameBoost,
          });
        }
      }

      // === PASS 5: Enhanced fuzzy matching (optimized with smart candidate selection) ===
      if (!matched) {
        // Build smart candidate set (union of multiple sources, limited to 150)
        const candidates = new Set<string>();
        
        // Add from Pass 4 token candidates if available
        sourceTokens.forEach(token => {
          const byToken = tokenIndex.get(token);
          if (byToken) byToken.forEach(id => candidates.add(id));
        });
        
        // Add from lastName indexes for all potential last names
        for (const lastName of sourceLastNames) {
          const byLastName = lastNameIndex.get(lastName);
          const byJoinedName = lastNameJoinedIndex.get(lastName);
          if (byLastName) byLastName.forEach(id => candidates.add(id));
          if (byJoinedName) byJoinedName.forEach(id => candidates.add(id));
        }
        
        // Add riders with matching first letter of any source last name (broader net)
        if (sourceLastNames.length > 0) {
          const firstLetters = new Set(sourceLastNames.map(ln => ln.charAt(0)));
          riderDataMap.forEach((data, riderId) => {
            if (firstLetters.has(data.lastName.charAt(0)) && candidates.size < 200) {
              candidates.add(riderId);
            }
          });
        }
        
        // Limit to 150 candidates
        const candidateList = Array.from(candidates).slice(0, 150);
        
        let bestMatch = null;
        let bestScore = 0;
        let bestRiderName = '';
        let bestTeamBonus = 0;
        let bestLastNameBoost = 0;
        let secondBestScore = 0;
        const teamSimCache = new Map<string, number>();

        // Only test 2 name variants (normalized + inverted) for efficiency
        const namesToTest = [
          normalized,
          normalizeText(invertName(entry.source_name)),
        ];

        for (const riderId of candidateList) {
          const riderData = riderDataMap.get(riderId)!;
          
          for (const testName of namesToTest) {
            let score = similarity(testName, riderData.nomNorm);
            let teamBonus = 0;
            let lastNameBoost = 0;
            
            if (sourceTeamNorm) {
              if (!teamSimCache.has(riderId)) {
                teamSimCache.set(riderId, similarity(sourceTeamNorm, riderData.teamNorm));
              }
              const teamSim = teamSimCache.get(riderId)!;
              const acronymSim = sourceTeamAcronym && riderData.teamAcronym
                ? similarity(sourceTeamAcronym, riderData.teamAcronym)
                : 0;
              
              if (teamSim > 0.75) {
                teamBonus = 0.15;
                score += teamBonus;
              } else if (teamSim > 0.60) {
                teamBonus = 0.08;
                score += teamBonus;
              } else if (acronymSim > 0.75) {
                teamBonus = 0.05;
                score += teamBonus;
              }
            }
            
            // Check if rider's last name matches any source last name
            const hasLastNameMatch = sourceLastNames.some(ln => 
              riderData.lastName === ln || riderData.lastNameAlt === ln
            );
            if (hasLastNameMatch) {
              lastNameBoost = 0.10;
              score += lastNameBoost;
            }

            if (score > bestScore) {
              secondBestScore = bestScore;
              bestScore = score;
              bestMatch = riderId;
              bestRiderName = riderData.nom;
              bestTeamBonus = teamBonus;
              bestLastNameBoost = lastNameBoost;
            } else if (score > secondBestScore) {
              secondBestScore = score;
            }
          }
        }

        let threshold = 0.82;
        if (bestLastNameBoost > 0 && bestTeamBonus >= 0.08) {
          threshold = 0.65;
        } else if (bestTeamBonus >= 0.05 || entry.source_team) {
          threshold = 0.75;
        }
        
        const scoreDiff = bestScore - secondBestScore;
        const tooClose = scoreDiff < 0.03 && secondBestScore > 0.70;
        
        if (bestMatch && bestScore >= threshold && !tooClose) {
          coureurId = bestMatch;
          confidence = Math.min(bestScore, 0.99);
          matched = true;
          matchMethod = 'fuzzy-enhanced';
          passFuzzy++;
        } else if (bestMatch && bestScore >= 0.70) {
          nearMisses.push({
            entry: entry.source_name,
            candidate: bestRiderName,
            score: bestScore,
            threshold,
            teamBonus: bestTeamBonus,
            lastNameBoost: bestLastNameBoost,
            ambiguous: tooClose,
          });
        }
      }

      if (matched) {
        matchedCount++;
      } else {
        unmatchedCount++;
      }

      matchedEntries.push({
        ...entry,
        coureur_id: coureurId,
        confidence: confidence,
        status: matched ? 'confirmed' : 'unmatched'
      });
    }

    // Log near-misses summary
    if (nearMisses.length > 0) {
      console.log(`\n=== NEAR-MISSES (${nearMisses.length}) ===`);
      nearMisses.slice(0, 10).forEach(nm => {
        console.log(`  "${nm.entry}" → "${nm.candidate}" (score: ${nm.score.toFixed(3)}, threshold: ${nm.threshold}, team: ${nm.teamBonus.toFixed(2)}, lastName: ${nm.lastNameBoost.toFixed(2)}${nm.ambiguous ? ' [AMBIGUOUS]' : ''})`);
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
    console.log(`\n=== MATCH BREAKDOWN BY PASS ===`);
    console.log(`  Pass 1 (Alias): ${passAlias}`);
    console.log(`  Pass 2 (Exact): ${passExact}`);
    console.log(`  Pass 3 (LastName+Init): ${passLastInit}`);
    console.log(`  Pass 4 (Token-Set): ${passTokenSet}`);
    console.log(`  Pass 5 (Fuzzy): ${passFuzzy}`);
    
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
