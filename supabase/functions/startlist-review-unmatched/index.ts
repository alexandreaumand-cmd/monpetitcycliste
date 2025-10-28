import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalize, extractLastName, similarity } from "../_shared/normalization.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const url = new URL(req.url);
    const startlist_id = url.searchParams.get('startlist_id');

    if (!startlist_id) {
      return new Response(
        JSON.stringify({ error: 'startlist_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[startlist-review-unmatched] Reviewing startlist ${startlist_id}`);

    // Récupérer les entrées non matchées
    const { data: unmatchedEntries, error: unmatchedError } = await supabase
      .from('startlist_entries')
      .select('id, line_no, bib_no, source_name, source_team')
      .eq('startlist_id', startlist_id)
      .eq('status', 'unmatched')
      .order('line_no');

    if (unmatchedError) throw unmatchedError;

    if (!unmatchedEntries || unmatchedEntries.length === 0) {
      return new Response(
        JSON.stringify({ entries: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[startlist-review-unmatched] Found ${unmatchedEntries.length} unmatched entries`);

    // Récupérer la phase via race_id
    const { data: importData, error: importError } = await supabase
      .from('startlist_imports')
      .select('race_id, courses!inner(phase_id)')
      .eq('id', startlist_id)
      .single();

    if (importError || !importData) {
      return new Response(
        JSON.stringify({ error: 'Import introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const courseData = (importData as any).courses;
    if (!courseData?.phase_id) {
      return new Response(
        JSON.stringify({ error: 'Phase introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phase_id = courseData.phase_id;

    // Charger roster unique de la phase
    const { data: rostersData, error: rostersError } = await supabase
      .from('rosters')
      .select('coureur_id, coureurs!inner(id, nom, equipe)')
      .eq('phase_id', phase_id);

    if (rostersError) throw rostersError;

    const rosterRiders: Array<{ id: string; nom: string; equipe: string | null }> = [];
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

    console.log(`[startlist-review-unmatched] Loaded ${rosterRiders.length} roster riders`);

    // Générer suggestions pour chaque entrée non matchée
    const results = unmatchedEntries.map(entry => {
      const entryNorm = normalize(entry.source_name);
      const entryLastName = extractLastName(entry.source_name);

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
        entry_id: entry.id,
        line_no: entry.line_no,
        bib_no: entry.bib_no,
        source_name: entry.source_name,
        source_team: entry.source_team,
        suggestions
      };
    });

    return new Response(
      JSON.stringify({ entries: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[startlist-review-unmatched] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
