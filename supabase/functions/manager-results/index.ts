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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    // Get manager_id from user
    const { data: manager } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      throw new Error('Manager non trouvé');
    }

    const { action, ...params } = await req.json();

    if (action === 'recent_races') {
      return await handleRecentRaces(supabaseClient, manager.id, params);
    } else if (action === 'course_results') {
      return await handleCourseResults(supabaseClient, manager.id, params);
    } else if (action === 'course_leaderboard') {
      return await handleCourseLeaderboard(supabaseClient, params);
    }

    throw new Error('Action inconnue');
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleRecentRaces(supabaseClient: any, managerId: string, params: any) {
  const { saison_id, phase_id, limit = 10 } = params;

  // Get courses with results
  let query = supabaseClient
    .from('courses')
    .select(`
      id,
      nom,
      date_debut,
      date_fin,
      categorie,
      phase_id,
      phases!inner(id, saison_id)
    `);

  if (saison_id) {
    query = query.eq('phases.saison_id', saison_id);
  }
  if (phase_id) {
    query = query.eq('phase_id', phase_id);
  }

  const { data: courses, error: coursesError } = await query;
  if (coursesError) throw coursesError;

  // For each course, get last result date, types, and my points
  const racesPromises = courses.map(async (course: any) => {
    // Get last result date and types
    const { data: results } = await supabaseClient
      .from('race_results')
      .select('date_classement, type_classement')
      .eq('course_id', course.id);

    if (!results || results.length === 0) return null;

    const lastResultAt = results.reduce((max: any, r: any) => 
      r.date_classement > max ? r.date_classement : max, results[0].date_classement);
    
    const types = [...new Set(results.map((r: any) => r.type_classement))];

    // Get my points for this course
    const { data: myPoints } = await supabaseClient
      .from('points_ledger')
      .select('points')
      .eq('course_id', course.id)
      .eq('manager_id', managerId);

    const totalPoints = myPoints?.reduce((sum: number, p: any) => sum + p.points, 0) || 0;
    const hasPoints = myPoints && myPoints.length > 0;

    return {
      course_id: course.id,
      nom: course.nom,
      date_debut: course.date_debut,
      date_fin: course.date_fin,
      categorie: course.categorie,
      phase_id: course.phase_id,
      last_result_at: lastResultAt,
      types,
      my_points: totalPoints,
      has_points: hasPoints,
    };
  });

  const allRaces = (await Promise.all(racesPromises)).filter(Boolean);
  
  // Sort by last_result_at DESC
  allRaces.sort((a: any, b: any) => {
    if (!a.last_result_at) return 1;
    if (!b.last_result_at) return -1;
    return new Date(b.last_result_at).getTime() - new Date(a.last_result_at).getTime();
  });

  const races = allRaces.slice(0, limit);

  // Get filters meta
  const { data: saisons } = await supabaseClient
    .from('saisons')
    .select('id, annee')
    .order('annee', { ascending: false });

  const { data: phases } = await supabaseClient
    .from('phases')
    .select('id, index_dans_saison, date_debut, date_fin, saison_id')
    .order('date_debut', { ascending: false });

  return new Response(
    JSON.stringify({ races, filters_meta: { saisons, phases } }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCourseResults(supabaseClient: any, managerId: string, params: any) {
  const { course_id, type_classement, etape_numero } = params;

  if (!course_id || !type_classement) {
    throw new Error('course_id et type_classement requis');
  }

  if (type_classement === 'Etape' && !etape_numero) {
    throw new Error('etape_numero requis pour type Etape');
  }

  // Get course info
  const { data: course, error: courseError } = await supabaseClient
    .from('courses')
    .select('id, nom, date_debut, date_fin, categorie, phase_id')
    .eq('id', course_id)
    .single();

  if (courseError) throw courseError;

  // Get available types and etapes
  const { data: allResults } = await supabaseClient
    .from('race_results')
    .select('type_classement, etape_numero')
    .eq('course_id', course_id);

  const types_disponibles = [...new Set(allResults?.map((r: any) => r.type_classement) || [])];
  const etapes_disponibles = [...new Set(
    allResults?.filter((r: any) => r.etape_numero).map((r: any) => r.etape_numero) || []
  )].sort((a: any, b: any) => a - b);

  // Get results for selected type/etape
  let resultsQuery = supabaseClient
    .from('race_results')
    .select(`
      position,
      statut,
      coureur_id,
      coureurs!inner(nom, equipe)
    `)
    .eq('course_id', course_id)
    .eq('type_classement', type_classement);

  if (type_classement === 'Etape') {
    resultsQuery = resultsQuery.eq('etape_numero', etape_numero);
  }

  const { data: results, error: resultsError } = await resultsQuery
    .order('position', { ascending: true, nullsFirst: false });

  if (resultsError) throw resultsError;

  // Check which riders are mine
  const { data: myRoster } = await supabaseClient
    .from('rosters')
    .select('coureur_id')
    .eq('phase_id', course.phase_id)
    .eq('manager_id', managerId);

  const myRiderIds = new Set(myRoster?.map((r: any) => r.coureur_id) || []);

  // Get scoring rules for this category
  const { data: scoringRules } = await supabaseClient
    .from('scoring_rules')
    .select('place, points, type_classement')
    .eq('categorie', course.categorie)
    .eq('type_classement', type_classement);

  const scoringMap = new Map(
    scoringRules?.map((r: any) => [r.place, r.points]) || []
  );

  const rows = results.map((r: any) => ({
    position: r.position,
    statut: r.statut,
    coureur_id: r.coureur_id,
    coureur_nom: r.coureurs.nom,
    equipe: r.coureurs.equipe,
    is_my_rider: myRiderIds.has(r.coureur_id),
    points_barreme: r.statut === 'finished' && r.position ? (scoringMap.get(r.position) || 0) : 0,
  }));

  // Get my total points for this course
  const { data: myPoints } = await supabaseClient
    .from('points_ledger')
    .select('points')
    .eq('course_id', course_id)
    .eq('manager_id', managerId);

  const my_points_course = myPoints?.reduce((sum: number, p: any) => sum + p.points, 0) || 0;

  return new Response(
    JSON.stringify({
      rows,
      meta: {
        course_nom: course.nom,
        date_debut: course.date_debut,
        date_fin: course.date_fin,
        categorie: course.categorie,
        phase_id: course.phase_id,
        my_points_course,
        types_disponibles,
        etapes_disponibles,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCourseLeaderboard(supabaseClient: any, params: any) {
  const { course_id } = params;

  if (!course_id) {
    throw new Error('course_id requis');
  }

  const { data: points, error } = await supabaseClient
    .from('points_ledger')
    .select(`
      manager_id,
      points,
      managers!inner(nom)
    `)
    .eq('course_id', course_id);

  if (error) throw error;

  // Group by manager
  const managersMap = new Map();
  points?.forEach((p: any) => {
    const existing = managersMap.get(p.manager_id);
    if (existing) {
      existing.total_points += p.points;
    } else {
      managersMap.set(p.manager_id, {
        manager_id: p.manager_id,
        manager_nom: p.managers.nom,
        total_points: p.points,
      });
    }
  });

  const leaders = Array.from(managersMap.values())
    .sort((a, b) => b.total_points - a.total_points);

  return new Response(
    JSON.stringify({ leaders }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
