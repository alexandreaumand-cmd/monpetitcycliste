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

    const { limit = 6 } = await req.json();

    // Get recent races with results from view
    const { data: recentCourses, error: coursesError } = await supabase
      .from('v_home_recent_results')
      .select('course_id, course_nom, date_fin, total_points')
      .order('date_fin', { ascending: false })
      .limit(limit);

    if (coursesError) {
      console.error('Error fetching recent courses:', coursesError);
      throw coursesError;
    }

    if (!recentCourses || recentCourses.length === 0) {
      return new Response(JSON.stringify({ races: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For each race, get metadata and top 10 from points_ledger
    const racesWithTop10 = await Promise.all(
      recentCourses.map(async (course) => {
        // Get top 10 from points_ledger with coureur names
        const { data: top10, error: topError } = await supabase
          .from('points_ledger')
          .select(`
            coureur_id,
            points,
            coureurs!inner(nom)
          `)
          .eq('course_id', course.course_id)
          .eq('type_classement', 'General')
          .is('etape_numero', null)
          .order('points', { ascending: false })
          .limit(10);

        if (topError) {
          console.error(`Error fetching top 10 for ${course.course_id}:`, topError);
        }

        // Get available classification types from points_ledger
        const { data: types, error: typesError } = await supabase
          .from('points_ledger')
          .select('type_classement')
          .eq('course_id', course.course_id)
          .is('etape_numero', null);

        const uniqueTypes = [...new Set((types || []).map(t => t.type_classement))];

        // Get available stages
        const { data: stages, error: stagesError } = await supabase
          .from('points_ledger')
          .select('etape_numero')
          .eq('course_id', course.course_id)
          .eq('type_classement', 'Etape')
          .not('etape_numero', 'is', null)
          .order('etape_numero');

        const uniqueStages = [...new Set((stages || []).map(s => s.etape_numero).filter(Boolean))];

        // Format top10 results
        const formattedTop10 = (top10 || []).map((r: any, index: number) => ({
          position: index + 1,
          coureur_nom: r.coureurs?.nom || '',
          coureur_equipe: '',
          points: r.points || 0
        }));

        return {
          course_id: course.course_id,
          course_nom: course.course_nom,
          date_fin: course.date_fin,
          total_points: course.total_points,
          top10: formattedTop10,
          types_disponibles: uniqueTypes,
          etapes_disponibles: uniqueStages
        };
      })
    );

    return new Response(JSON.stringify({ races: racesWithTop10 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in home-recent-results-top10:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
