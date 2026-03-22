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
      .select('id, line_no, bib_no, status, source_name, source_team, coureur_id, team_confirmed')
      .eq('startlist_id', startlist_id)
      .order('line_no', { ascending: true });

    if (entriesError) throw entriesError;

    // OPTIMIZED: Batch fetch all coureurs_saisons in one query
    const coureurIds = (entries || [])
      .filter(e => e.coureur_id)
      .map(e => e.coureur_id);

    const coureursMap = new Map<string, { nom: string; equipe: string }>();

    if (coureurIds.length > 0 && saisonId) {
      // Batch fetch all coureurs_saisons
      const { data: allCoureursSaisons } = await supabase
        .from('coureurs_saisons')
        .select('coureur_id, coureurs!inner(nom), equipe_id')
        .eq('saison_id', saisonId)
        .in('coureur_id', coureurIds);

      // Batch fetch all equipes_saisons
      const equipeIds = [...new Set(
        (allCoureursSaisons || [])
          .filter(cs => cs.equipe_id)
          .map(cs => cs.equipe_id)
      )];

      const equipesMap = new Map<string, string>();
      if (equipeIds.length > 0) {
        const { data: allEquipes } = await supabase
          .from('equipes_saisons')
          .select('id, nom_affiche')
          .in('id', equipeIds);

        (allEquipes || []).forEach(e => {
          equipesMap.set(e.id, e.nom_affiche || '');
        });
      }

      // Build the coureurs map with O(1) lookups
      (allCoureursSaisons || []).forEach(cs => {
        const coureurInfo = cs.coureurs as any;
        coureursMap.set(cs.coureur_id, {
          nom: coureurInfo?.nom || '',
          equipe: equipesMap.get(cs.equipe_id) || ''
        });
      });
    }

    // Enrich entries using the pre-built map (no additional queries)
    const enrichedEntries = (entries || []).map(entry => ({
      ...entry,
      coureurs: entry.coureur_id ? coureursMap.get(entry.coureur_id) || null : null
    }));

    // Calculate stats
    const total = enrichedEntries.length;
    const matched = enrichedEntries.filter(e => e.coureur_id !== null).length;
    const unmatched = total - matched;
    const confirmedRiders = enrichedEntries.filter(e => e.team_confirmed === true).length;

    // Count confirmed/total teams
    const teamConfirmationMap = new Map<string, boolean>();
    for (const entry of enrichedEntries) {
      const teamKey = entry.coureurs?.equipe || entry.source_team || 'unknown';
      if (!teamConfirmationMap.has(teamKey)) {
        teamConfirmationMap.set(teamKey, entry.team_confirmed === true);
      }
    }
    const totalTeams = teamConfirmationMap.size;
    const confirmedTeams = [...teamConfirmationMap.values()].filter(v => v).length;

    const result = {
      entries: enrichedEntries,
      stats: {
        total,
        matched,
        unmatched,
        confirmed_riders: confirmedRiders,
        confirmed_teams: confirmedTeams,
        total_teams: totalTeams
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
