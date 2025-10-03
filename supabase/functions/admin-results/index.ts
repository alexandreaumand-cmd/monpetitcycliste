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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'list_results') {
      return await listResults(req, supabase);
    } else if (action === 'save_batch') {
      return await saveBatch(req, supabase, user.id);
    } else if (action === 'compute_points') {
      return await computePoints(req, supabase);
    } else if (action === 'preview_points') {
      return await previewPoints(req, supabase);
    }

    throw new Error('Unknown action');
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function listResults(req: Request, supabase: any) {
  const { course_id, type_classement, etape_numero, search } = await req.json();

  if (!course_id || !type_classement) {
    throw new Error('course_id and type_classement required');
  }

  // Get course metadata
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, nom, date_debut, date_fin, categorie, type_course')
    .eq('id', course_id)
    .single();

  if (courseError) throw courseError;

  // Build query for results
  let query = supabase
    .from('race_results')
    .select(`
      id,
      course_id,
      type_classement,
      etape_numero,
      coureur_id,
      position,
      statut,
      points,
      updated_at,
      updated_by_manager_id,
      coureurs (nom, equipe),
      managers:updated_by_manager_id (nom)
    `)
    .eq('course_id', course_id)
    .eq('type_classement', type_classement);

  if (type_classement === 'Etape') {
    if (!etape_numero) throw new Error('etape_numero required for Etape type');
    query = query.eq('etape_numero', etape_numero);
  }

  const { data: results, error: resultsError } = await query;
  if (resultsError) throw resultsError;

  // Filter by search if provided
  let filteredResults = results || [];
  if (search && search.trim()) {
    const searchLower = search.toLowerCase();
    filteredResults = filteredResults.filter((r: any) =>
      r.coureurs?.nom?.toLowerCase().includes(searchLower)
    );
  }

  // Format results
  const formattedResults = filteredResults.map((r: any) => ({
    race_result_id: r.id,
    course_id: r.course_id,
    type_classement: r.type_classement,
    etape_numero: r.etape_numero,
    coureur_id: r.coureur_id,
    coureur_nom: r.coureurs?.nom || '',
    equipe: r.coureurs?.equipe || '',
    position: r.position,
    statut: r.statut,
    points_calcules: r.points,
    last_updated_at: r.updated_at,
    last_updated_by: r.managers?.nom || null,
  }));

  // Sort: nulls last, then by position, then by name
  formattedResults.sort((a: any, b: any) => {
    if (a.position === null && b.position !== null) return 1;
    if (a.position !== null && b.position === null) return -1;
    if (a.position !== b.position) return (a.position || 0) - (b.position || 0);
    return (a.coureur_nom || '').localeCompare(b.coureur_nom || '');
  });

  return new Response(
    JSON.stringify({
      results: formattedResults,
      course_meta: {
        nom: course.nom,
        date_debut: course.date_debut,
        date_fin: course.date_fin,
        categorie: course.categorie,
        type_course: course.type_course,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function saveBatch(req: Request, supabase: any, userId: string) {
  const { updates } = await req.json();

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('updates array required');
  }

  // Get manager_id for this user
  const { data: manager } = await supabase
    .from('managers')
    .select('id')
    .eq('user_id', userId)
    .single();

  const updatedResults = [];

  for (const update of updates) {
    const { race_result_id, position, statut } = update;

    // Validate
    if (!race_result_id || !statut) {
      throw new Error('race_result_id and statut required');
    }

    let finalPosition = position;
    if (statut !== 'finished') {
      finalPosition = null;
    } else if (!position || position < 1) {
      throw new Error(`Invalid position for finished status: ${race_result_id}`);
    }

    // Update
    const { data, error } = await supabase
      .from('race_results')
      .update({
        position: finalPosition,
        statut,
        updated_at: new Date().toISOString(),
        updated_by_manager_id: manager?.id || null,
      })
      .eq('id', race_result_id)
      .select(`
        id,
        course_id,
        type_classement,
        etape_numero,
        coureur_id,
        position,
        statut,
        points,
        updated_at,
        updated_by_manager_id,
        coureurs (nom, equipe),
        managers:updated_by_manager_id (nom)
      `)
      .single();

    if (error) throw error;

    updatedResults.push({
      race_result_id: data.id,
      course_id: data.course_id,
      type_classement: data.type_classement,
      etape_numero: data.etape_numero,
      coureur_id: data.coureur_id,
      coureur_nom: data.coureurs?.nom || '',
      equipe: data.coureurs?.equipe || '',
      position: data.position,
      statut: data.statut,
      points_calcules: data.points,
      last_updated_at: data.updated_at,
      last_updated_by: data.managers?.nom || null,
    });
  }

  return new Response(
    JSON.stringify({ updated: updatedResults }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function computePoints(req: Request, supabase: any) {
  const { course_id } = await req.json();

  if (!course_id) {
    throw new Error('course_id required');
  }

  // Call existing compute function (adjust if you have a different one)
  const { error } = await supabase.rpc('compute_points_for_course', { p_course_id: course_id });
  
  if (error) {
    console.error('Compute points error:', error);
    // Continue even if function doesn't exist yet
  }

  // Get leaderboard
  const { data: leaderboard } = await supabase
    .from('points_ledger')
    .select(`
      manager_id,
      points,
      managers (nom)
    `)
    .eq('course_id', course_id);

  // Aggregate by manager
  const managerTotals = new Map();
  (leaderboard || []).forEach((entry: any) => {
    const managerId = entry.manager_id;
    const managerNom = entry.managers?.nom || 'Unknown';
    const current = managerTotals.get(managerId) || { manager_id: managerId, manager_nom: managerNom, total_points: 0 };
    current.total_points += entry.points;
    managerTotals.set(managerId, current);
  });

  const leaderboardArray = Array.from(managerTotals.values());
  leaderboardArray.sort((a, b) => b.total_points - a.total_points);

  return new Response(
    JSON.stringify({ leaderboard_course: leaderboardArray }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function previewPoints(req: Request, supabase: any) {
  const { course_id, updates } = await req.json();

  // This would simulate points calculation without writing
  // For now, return a simple placeholder
  return new Response(
    JSON.stringify({
      preview: {
        before: [],
        after: [],
        note: 'Preview not yet implemented',
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
