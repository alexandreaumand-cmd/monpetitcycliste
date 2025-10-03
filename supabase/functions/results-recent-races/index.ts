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

    const { saison_id, phase_id, search, limit = 12 } = await req.json();

    // Get the manager ID for the current user
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const managerId = manager?.id;

    // Build query for recent races with results
    let query = supabase
      .from('race_results')
      .select(`
        course_id,
        date_classement,
        courses!inner(
          id,
          nom,
          categorie,
          date_debut,
          date_fin,
          phases!inner(
            id,
            saison_id
          )
        )
      `)
      .order('date_classement', { ascending: false });

    // Apply filters
    if (saison_id) {
      query = query.eq('courses.phases.saison_id', saison_id);
    }
    if (phase_id) {
      query = query.eq('courses.phase_id', phase_id);
    }
    if (search) {
      query = query.ilike('courses.nom', `%${search}%`);
    }

    const { data: results, error } = await query;

    if (error) throw error;

    // Group by course and get details
    const courseMap = new Map();
    
    for (const result of results || []) {
      const courseId = result.course_id;
      const courseData = Array.isArray(result.courses) ? result.courses[0] : result.courses;
      
      if (!courseMap.has(courseId) && courseData) {
        // Get distinct classification types for this course
        const { data: types } = await supabase
          .from('race_results')
          .select('type_classement')
          .eq('course_id', courseId);

        const distinctTypes = [...new Set(types?.map(t => t.type_classement) || [])];

        // Get my points if manager exists
        let myPoints = 0;
        let hasPoints = false;

        if (managerId) {
          const { data: points } = await supabase
            .from('points_ledger')
            .select('points')
            .eq('course_id', courseId)
            .eq('manager_id', managerId);

          myPoints = points?.reduce((sum, p) => sum + p.points, 0) || 0;
        }

        // Check if any points exist for this course
        const { count } = await supabase
          .from('points_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', courseId);

        hasPoints = (count || 0) > 0;

        const phaseData = Array.isArray(courseData.phases) ? courseData.phases[0] : courseData.phases;

        courseMap.set(courseId, {
          course_id: courseId,
          nom: courseData.nom,
          categorie: courseData.categorie,
          date_debut: courseData.date_debut,
          date_fin: courseData.date_fin,
          phase_id: phaseData?.id,
          last_result_at: result.date_classement,
          types: distinctTypes,
          my_points: myPoints,
          has_points: hasPoints,
        });
      }
    }

    // Convert to array and limit
    const races = Array.from(courseMap.values())
      .sort((a, b) => new Date(b.last_result_at).getTime() - new Date(a.last_result_at).getTime())
      .slice(0, limit);

    return new Response(JSON.stringify({ races }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-recent-races:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
