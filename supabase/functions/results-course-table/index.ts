import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_id, type_classement, etape_numero } = await req.json();

    if (!course_id || !type_classement) {
      return new Response(JSON.stringify({ error: 'course_id and type_classement are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, nom, categorie, date_debut, date_fin, phase_id')
      .eq('id', course_id)
      .single();

    if (courseError || !course) throw courseError || new Error('Course not found');

    // Get the manager ID for the current user
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const managerId = manager?.id;

    // Build base query for race results
    let query = supabase
      .from('race_results')
      .select(`
        id,
        position,
        statut,
        coureur_id,
        etape_numero,
        coureurs!inner(nom, equipe)
      `)
      .eq('course_id', course_id)
      .eq('type_classement', type_classement);

    if (type_classement === 'Etape' && etape_numero) {
      query = query.eq('etape_numero', etape_numero);
    }

    const { data: raceResults, error: resultsError } = await query;

    if (resultsError) throw resultsError;

    // Get available types and stages
    const { data: allResults } = await supabase
      .from('race_results')
      .select('type_classement, etape_numero')
      .eq('course_id', course_id);

    const typesDisponibles = [...new Set(allResults?.map(r => r.type_classement) || [])];
    const etapesDisponibles = type_classement === 'Etape' 
      ? [...new Set(allResults?.filter(r => r.type_classement === 'Etape').map(r => r.etape_numero).filter(Boolean) || [])].sort((a, b) => a - b)
      : [];

    // Process each result to get manager info and points
    const rows = await Promise.all((raceResults || []).map(async (result) => {
      // Get roster info for this rider in this phase
      const { data: roster } = await supabase
        .from('rosters')
        .select('manager_id, managers(nom)')
        .eq('coureur_id', result.coureur_id)
        .eq('phase_id', course.phase_id)
        .single();

      const managerIdForRider = roster?.manager_id;
      const managers = Array.isArray(roster?.managers) ? roster.managers[0] : roster?.managers;
      const managerNom = managers?.nom;
      const isMyRider = managerId && managerIdForRider === managerId;

      // Get official points from points_ledger
      let pointsOfficiels = null;
      if (managerIdForRider) {
        let pointsQuery = supabase
          .from('points_ledger')
          .select('points')
          .eq('course_id', course_id)
          .eq('coureur_id', result.coureur_id)
          .eq('manager_id', managerIdForRider)
          .eq('type_classement', type_classement);

        if (type_classement === 'Etape' && etape_numero) {
          pointsQuery = pointsQuery.eq('etape_numero', etape_numero);
        }

        const { data: pointsData } = await pointsQuery;
        if (pointsData && pointsData.length > 0) {
          pointsOfficiels = pointsData.reduce((sum, p) => sum + p.points, 0);
        }
      }

      // Get theoretical points from scoring_rules if finished and positioned
      let pointsTheoriques = 0;
      if (result.statut === 'finished' && result.position) {
        const { data: scoringRule } = await supabase
          .from('scoring_rules')
          .select('points')
          .eq('categorie', course.categorie)
          .eq('type_classement', type_classement)
          .eq('place', result.position)
          .single();

        pointsTheoriques = scoringRule?.points || 0;
      }

      const coureurs = Array.isArray(result.coureurs) ? result.coureurs[0] : result.coureurs;

      return {
        position: result.position,
        statut: result.statut,
        coureur_id: result.coureur_id,
        coureur_nom: coureurs?.nom,
        equipe: coureurs?.equipe,
        manager_id: managerIdForRider,
        manager_nom: managerNom,
        points_officiels: pointsOfficiels,
        points_theoriques: pointsTheoriques,
        is_my_rider: isMyRider,
      };
    }));

    // Sort: null positions last, then by position, then by name
    rows.sort((a, b) => {
      if (a.position === null && b.position === null) return (a.coureur_nom || '').localeCompare(b.coureur_nom || '');
      if (a.position === null) return 1;
      if (b.position === null) return -1;
      if (a.position !== b.position) return a.position - b.position;
      return (a.coureur_nom || '').localeCompare(b.coureur_nom || '');
    });

    return new Response(JSON.stringify({
      rows,
      meta: {
        course_nom: course.nom,
        categorie: course.categorie,
        date_debut: course.date_debut,
        date_fin: course.date_fin,
        types_disponibles: typesDisponibles,
        etapes_disponibles: etapesDisponibles,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-course-table:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
