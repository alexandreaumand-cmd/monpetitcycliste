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
          phase_id
        )
      `)
      .eq('id', startlist_id)
      .single();

    if (startlistError || !startlist) {
      throw new Error('Startlist not found');
    }

    const race = Array.isArray(startlist.courses) ? startlist.courses[0] : startlist.courses;
    const phaseId = race.phase_id;

    // Get confirmed entries with coureur details
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
      .eq('status', 'confirmed')
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
          nom
        )
      `)
      .eq('phase_id', phaseId);

    if (rostersError) throw rostersError;

    // Build manager map
    const managerMap = new Map();
    
    for (const roster of rosters) {
      const managerData = Array.isArray(roster.managers) ? roster.managers[0] : roster.managers;
      if (!managerMap.has(roster.manager_id)) {
        managerMap.set(roster.manager_id, {
          manager_id: roster.manager_id,
          manager_nom: managerData.nom,
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
        phase_id: phaseId
      },
      managers,
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
