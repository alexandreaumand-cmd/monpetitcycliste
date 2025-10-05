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
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ') // Compress multiple spaces
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

// Parse name: "NESPOLI Lorenzo" -> "Lorenzo NESPOLI"
function canonizeName(nameRaw: string): string {
  const tokens = nameRaw.trim().split(/\s+/);
  
  // Find where ALLCAPS tokens end
  let i = 0;
  while (i < tokens.length && /^[A-ZÀ-Ÿ''\-]+$/.test(tokens[i])) {
    i++;
  }
  
  const surnameTokens = tokens.slice(0, i);
  const givenTokens = tokens.slice(i);
  
  const surname = surnameTokens.join(' ').toUpperCase();
  const given = givenTokens.map(t => 
    t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  ).join(' ');
  
  if (given && surname) {
    return `${given} ${surname}`;
  }
  return nameRaw;
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

    const { race_id, phase_id, text } = await req.json();

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
    
    // Regex: 0. MBH NESPOLI Lorenzo 0:00
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
        
        parsedEntries.push({
          line_no: i + 1,
          team_code: teamCode,
          source_name: nameRaw,
          canonical_guess: canonicalGuess,
        });
      }
    }

    // Load riders
    const { data: riders } = await supabase
      .from('coureurs')
      .select('id, nom, equipe');

    // Match each entry
    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const entry of parsedEntries) {
      const normalized = normalizeText(entry.canonical_guess);
      let bestMatch = null;
      let bestScore = 0;

      if (riders) {
        for (const rider of riders) {
          const riderNorm = normalizeText(rider.nom);
          
          // Exact match
          if (riderNorm === normalized) {
            bestMatch = rider;
            bestScore = 1.0;
            break;
          }

          // Swapped name
          const parts = normalized.split(' ');
          if (parts.length >= 2) {
            const last = parts[parts.length - 1];
            const first = parts.slice(0, -1).join(' ');
            const swapped = `${last} ${first}`;
            if (riderNorm === swapped) {
              bestMatch = rider;
              bestScore = 0.98;
              break;
            }
          }

          // Fuzzy match
          const score = similarity(normalized, riderNorm);
          if (score >= 0.90 && score > bestScore) {
            bestScore = score;
            bestMatch = rider;
          }
        }
      }

      if (bestMatch && bestScore >= 0.90) {
        matched.push({
          ...entry,
          coureur_id: bestMatch.id,
          nom: bestMatch.nom,
          equipe: bestMatch.equipe,
          confidence: bestScore,
        });
      } else {
        // Get suggestions
        const suggestions = riders
          ?.map(r => ({
            coureur_id: r.id,
            nom: r.nom,
            equipe: r.equipe,
            score: similarity(normalized, normalizeText(r.nom))
          }))
          .filter(s => s.score >= 0.70)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5) || [];

        unmatched.push({
          ...entry,
          suggestions,
        });
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

    return new Response(
      JSON.stringify({
        phase_id: phaseId,
        race_id: raceId,
        counts: {
          lines: parsedEntries.length,
          matched: matched.length,
          unmatched: unmatched.length,
        },
        managers,
        no_owner: noOwner.sort((a, b) => a.nom.localeCompare(b.nom)),
        unmatched: unmatched.sort((a, b) => a.line_no - b.line_no),
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
