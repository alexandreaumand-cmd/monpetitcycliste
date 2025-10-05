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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\.]/g, ' ')
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

    const { startlist_id, search } = await req.json();

    if (!startlist_id) {
      return new Response(
        JSON.stringify({ error: 'startlist_id est requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unmatched entries
    let query = supabase
      .from('startlist_entries')
      .select('id, line_no, source_name, source_team, bib_no')
      .eq('startlist_id', startlist_id)
      .eq('status', 'unmatched')
      .order('line_no', { ascending: true });

    const { data: unmatchedEntries, error: entriesError } = await query;

    if (entriesError) {
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des entrées' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all riders
    const { data: riders } = await supabase
      .from('coureurs')
      .select('id, nom, equipe');

    // Generate suggestions for each unmatched entry
    const items = unmatchedEntries?.map(entry => {
      const normalized = normalizeText(entry.source_name);
      const suggestions: any[] = [];

      if (riders) {
        for (const rider of riders) {
          const riderNorm = normalizeText(rider.nom);
          let score = similarity(normalized, riderNorm);

          // Bonus if team matches
          if (entry.source_team && rider.equipe) {
            const teamSimilarity = similarity(
              normalizeText(entry.source_team),
              normalizeText(rider.equipe)
            );
            if (teamSimilarity > 0.7) {
              score += 0.15;
            }
          }

          // Swapped name bonus
          const parts = normalized.split(' ');
          if (parts.length === 2) {
            const swapped = `${parts[1]} ${parts[0]}`;
            const swappedScore = similarity(swapped, riderNorm);
            score = Math.max(score, swappedScore);
          }

          if (score >= 0.5) {
            suggestions.push({
              coureur_id: rider.id,
              nom: rider.nom,
              equipe: rider.equipe,
              score: Math.round(score * 100) / 100,
            });
          }
        }
      }

      // Sort by score and take top 5
      suggestions.sort((a, b) => b.score - a.score);
      const topSuggestions = suggestions.slice(0, 5);

      return {
        entry_id: entry.id,
        line_no: entry.line_no,
        source_name: entry.source_name,
        source_team: entry.source_team,
        bib_no: entry.bib_no,
        suggestions: topSuggestions,
      };
    }) || [];

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in startlist-review-unmatched:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
