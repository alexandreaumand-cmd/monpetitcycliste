import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  manager_id: string;
  phase_id?: string | null;
  saison_id?: string | null;
  search?: string | null;
  limit?: number | null;
  offset?: number | null;
  league_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { 
      manager_id, 
      phase_id, 
      saison_id, 
      search, 
      limit = 50, 
      offset = 0,
      league_id
    }: RequestBody = await req.json();

    console.log('get-team-scoring called with:', { manager_id, phase_id, saison_id, search, limit, offset, league_id });

    if (!manager_id) {
      throw new Error('manager_id is required');
    }

    // Get manager info
    const { data: manager, error: managerError } = await supabaseClient
      .from('managers')
      .select('id, nom')
      .eq('id', manager_id)
      .single();

    if (managerError) throw managerError;

    // Build roster scope - get relevant phase IDs
    let phaseIds: string[] = [];
    if (phase_id) {
      phaseIds = [phase_id];
    } else if (saison_id) {
      const { data: phases } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      phaseIds = phases?.map(p => p.id) || [];
    } else {
      const { data: allPhases } = await supabaseClient
        .from('phases')
        .select('id');
      phaseIds = allPhases?.map(p => p.id) || [];
    }

    if (phaseIds.length === 0) {
      return new Response(JSON.stringify({
        team: { manager_id, manager_nom: manager.nom },
        scope: { phase_id, saison_id },
        totals: { points_total: 0, riders_count: 0, courses_count: 0 },
        items: [],
        pagination: { limit, offset, has_more: false }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get roster coureurs for this manager in scope
    let rosterQuery = supabaseClient
      .from('rosters')
      .select('coureur_id')
      .eq('manager_id', manager_id)
      .in('phase_id', phaseIds);
    
    if (league_id) {
      rosterQuery = rosterQuery.eq('league_id', league_id);
    }
    
    const { data: rosterCoureurs, error: rosterError } = await rosterQuery;

    if (rosterError) throw rosterError;

    const coureurIds = [...new Set(rosterCoureurs?.map(r => r.coureur_id) || [])];

    if (coureurIds.length === 0) {
      return new Response(JSON.stringify({
        team: { manager_id, manager_nom: manager.nom },
        scope: { phase_id, saison_id },
        totals: { points_total: 0, riders_count: 0, courses_count: 0 },
        items: [],
        pagination: { limit, offset, has_more: false }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get points for these coureurs in scope
    const { data: pointsData, error: pointsError } = await supabaseClient
      .from('points_ledger')
      .select('coureur_id, course_id, points, created_at')
      .in('phase_id', phaseIds)
      .in('coureur_id', coureurIds);

    if (pointsError) throw pointsError;

    // Aggregate by coureur
    const coureurStats = new Map<string, {
      points_total: number;
      courses: Set<string>;
      last_scored_at: string | null;
    }>();

    pointsData?.forEach((row) => {
      if (!coureurStats.has(row.coureur_id)) {
        coureurStats.set(row.coureur_id, {
          points_total: 0,
          courses: new Set(),
          last_scored_at: null
        });
      }
      const stats = coureurStats.get(row.coureur_id)!;
      stats.points_total += row.points;
      stats.courses.add(row.course_id);
      if (!stats.last_scored_at || row.created_at > stats.last_scored_at) {
        stats.last_scored_at = row.created_at;
      }
    });

    // Filter coureurs with points > 0
    const coureurIdsWithPoints = Array.from(coureurStats.keys()).filter(
      id => coureurStats.get(id)!.points_total > 0
    );

    // Get coureur details with team from equipes_saisons
    // First get saison_id from phase
    let saisonId: string | null = null;
    if (phase_id) {
      const { data: phaseData } = await supabaseClient
        .from('phases')
        .select('saison_id')
        .eq('id', phase_id)
        .single();
      saisonId = phaseData?.saison_id || null;
    } else if (saison_id) {
      saisonId = saison_id;
    }
    
    let coureursQuery = supabaseClient
      .from('coureurs')
      .select(`
        id,
        nom,
        coureurs_saisons!inner(
          equipe_id,
          equipes_saisons!inner(nom_affiche)
        )
      `)
      .in('id', coureurIdsWithPoints);

    if (saisonId) {
      coureursQuery = coureursQuery.eq('coureurs_saisons.saison_id', saisonId);
    }

    if (search && search.trim()) {
      coureursQuery = coureursQuery.ilike('nom', `%${search}%`);
    }

    const { data: coureursData, error: coureursError } = await coureursQuery;

    if (coureursError) throw coureursError;
    
    const coureurs = coureursData?.map((c: any) => ({
      id: c.id,
      nom: c.nom,
      equipe: Array.isArray(c.coureurs_saisons) && c.coureurs_saisons[0]?.equipes_saisons?.nom_affiche || 'N/A'
    })) || [];

    // Build items array
    const items = coureurs?.map(c => {
      const stats = coureurStats.get(c.id)!;
      return {
        rider_id: c.id,
        rider_nom: c.nom,
        rider_equipe: c.equipe,
        points_total: stats.points_total,
        nb_courses: stats.courses.size,
        last_scored_at: stats.last_scored_at
      };
    }).sort((a, b) => {
      if (b.points_total !== a.points_total) {
        return b.points_total - a.points_total;
      }
      return a.rider_nom.localeCompare(b.rider_nom);
    }) || [];

    // Calculate totals
    const totals = {
      points_total: items.reduce((sum, item) => sum + item.points_total, 0),
      riders_count: items.length,
      courses_count: new Set(pointsData?.map(p => p.course_id) || []).size
    };

    // Pagination
    const actualOffset = offset ?? 0;
    const actualLimit = limit ?? 50;
    const paginatedItems = items.slice(actualOffset, actualOffset + actualLimit);
    const has_more = items.length > actualOffset + actualLimit;

    const response = {
      team: { manager_id, manager_nom: manager.nom },
      scope: { phase_id, saison_id },
      totals,
      items: paginatedItems,
      pagination: { limit: actualLimit, offset: actualOffset, has_more }
    };

    console.log('Returning team scoring:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-team-scoring:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
