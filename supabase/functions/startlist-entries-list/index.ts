import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { startlist_id } = await req.json();

    console.log('Fetching entries for startlist:', startlist_id);

    // Get startlist to find saison_id
    const { data: startlistData } = await supabase
      .from('startlist_imports')
      .select('race_id, courses!inner(phase_id, phases!inner(saison_id))')
      .eq('id', startlist_id)
      .single();

    const race = Array.isArray(startlistData?.courses) ? startlistData.courses[0] : startlistData?.courses;
    const phase = Array.isArray(race?.phases) ? race.phases[0] : race?.phases;
    const saisonId = phase?.saison_id;

    // Get all entries without coureur details
    const { data: entries, error: entriesError } = await supabase
      .from('startlist_entries')
      .select('id, line_no, bib_no, status, source_name, source_team, coureur_id')
      .eq('startlist_id', startlist_id)
      .order('line_no', { ascending: true });

    if (entriesError) throw entriesError;

    // Enrich with coureur data from coureurs_saisons + equipes_saisons
    const enrichedEntries = [];
    for (const entry of (entries || [])) {
      let coureurData = null;
      
      if (entry.coureur_id && saisonId) {
        const { data: csData } = await supabase
          .from('coureurs_saisons')
          .select('coureur_id, coureurs!inner(nom), equipe_id')
          .eq('saison_id', saisonId)
          .eq('coureur_id', entry.coureur_id)
          .limit(1);

        if (csData && csData.length > 0) {
          const cs = csData[0];
          let equipeName = '';
          
          if (cs.equipe_id) {
            const { data: equipeData } = await supabase
              .from('equipes_saisons')
              .select('nom_affiche')
              .eq('id', cs.equipe_id)
              .limit(1);
            equipeName = equipeData?.[0]?.nom_affiche || '';
          }
          
          coureurData = {
            nom: (cs.coureurs as any)?.nom || '',
            equipe: equipeName
          };
        }
      }

      enrichedEntries.push({
        ...entry,
        coureurs: coureurData
      });
    }

    // Calculate stats
    const total = enrichedEntries.length;
    const matched = enrichedEntries.filter(e => e.coureur_id !== null).length;
    const unmatched = total - matched;

    const result = {
      entries: enrichedEntries,
      stats: {
        total,
        matched,
        unmatched
      }
    };

    console.log('Entries result:', { total, matched, unmatched });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in startlist-entries-list:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
