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

    console.log('Fetching manager view for startlist:', startlist_id);

    // Get startlist and race info
    const { data: startlist, error: startlistError } = await supabase
      .from('startlist_imports')
      .select(`
        id,
        race_id,
        courses!inner(
          id,
          nom,
          date_debut,
          phase_id,
          categorie
        )
      `)
      .eq('id', startlist_id)
      .single();

    if (startlistError || !startlist) {
      throw new Error('Startlist not found');
    }

    const race = Array.isArray(startlist.courses) ? startlist.courses[0] : startlist.courses;
    const phaseId = race.phase_id;

    // Get all matched entries (any status as long as coureur_id is set)
    const { data: entries, error: entriesError } = await supabase
      .from('startlist_entries')
      .select(`
        coureur_id,
        bib_no,
        coureurs!inner(
          id,
          nom,
          equipe
        )
      `)
      .eq('startlist_id', startlist_id)
      .not('coureur_id', 'is', null);

    if (entriesError) throw entriesError;

    // Get rosters for this phase
    const { data: rosters, error: rostersError } = await supabase
      .from('rosters')
      .select(`
        manager_id,
        coureur_id,
        managers!inner(
          id,
          nom,
          sponsor
        )
      `)
      .eq('phase_id', phaseId);

    if (rostersError) throw rostersError;

    // Get phase standings
    const { data: phaseStandings } = await supabase
      .from('v_manager_standings_by_phase')
      .select('*')
      .eq('phase_id', phaseId)
      .order('total_points', { ascending: false });

    // Get total standings
    const { data: totalStandings } = await supabase
      .from('v_manager_standings_total')
      .select('*')
      .order('total_points', { ascending: false });

    // Get scoring rules for this race category
    const { data: scoringRules } = await supabase
      .from('scoring_rules')
      .select('type_classement, place, points')
      .eq('categorie', race.categorie)
      .order('type_classement')
      .order('place');

    // Build manager map with standings
    const managerMap = new Map();
    
    for (const roster of rosters) {
      const managerData = Array.isArray(roster.managers) ? roster.managers[0] : roster.managers;
      if (!managerMap.has(roster.manager_id)) {
        // Find standings for this manager
        const phaseStanding = phaseStandings?.find(s => s.manager_id === roster.manager_id);
        const totalStanding = totalStandings?.find(s => s.manager_id === roster.manager_id);
        
        // Calculate phase rank
        const phaseRank = phaseStandings ? phaseStandings.findIndex(s => s.manager_id === roster.manager_id) + 1 || null : null;
        const totalRank = totalStandings ? totalStandings.findIndex(s => s.manager_id === roster.manager_id) + 1 || null : null;
        
        // Calculate gaps with adjacent managers in phase standings
        let gap_prev_phase = null;
        let gap_next_phase = null;
        if (phaseRank && phaseStandings) {
          const prevManager = phaseStandings[phaseRank - 2]; // -2 because array is 0-indexed
          const nextManager = phaseStandings[phaseRank]; // Next is at current rank index
          
          if (prevManager) {
            gap_prev_phase = (phaseStanding?.total_points || 0) - (prevManager.total_points || 0);
          }
          if (nextManager) {
            gap_next_phase = (phaseStanding?.total_points || 0) - (nextManager.total_points || 0);
          }
        }
        
        managerMap.set(roster.manager_id, {
          manager_id: roster.manager_id,
          manager_nom: managerData.nom,
          sponsor: managerData.sponsor,
          rank_phase: phaseRank,
          rank_total: totalRank,
          points_phase: phaseStanding?.total_points || 0,
          points_total: totalStanding?.total_points || 0,
          gap_prev_phase,
          gap_next_phase,
          starters: [],
          starters_count: 0
        });
      }
    }

    // Match entries to managers
    for (const entry of entries) {
      const coureurData = Array.isArray(entry.coureurs) ? entry.coureurs[0] : entry.coureurs;
      const roster = rosters.find(r => r.coureur_id === entry.coureur_id);
      if (roster) {
        const manager = managerMap.get(roster.manager_id);
        manager.starters.push({
          coureur_id: entry.coureur_id,
          nom: coureurData.nom,
          equipe: coureurData.equipe,
          bib_no: entry.bib_no
        });
        manager.starters_count++;
      }
    }

    // Sort starters by name within each manager
    for (const manager of managerMap.values()) {
      manager.starters.sort((a: any, b: any) => a.nom.localeCompare(b.nom));
    }

    const managers = Array.from(managerMap.values())
      .filter(m => m.starters_count > 0)
      .sort((a, b) => b.starters_count - a.starters_count);

    const result = {
      race: {
        id: race.id,
        nom: race.nom,
        date_debut: race.date_debut,
        phase_id: phaseId,
        categorie: race.categorie
      },
      managers,
      scoring: {
        categorie: race.categorie,
        rules: scoringRules || []
      },
      totals: {
        managers: managers.length,
        starters_all: entries.length
      }
    };

    console.log('Manager view result:', result.totals);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in startlist-manager-view:', error);
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
