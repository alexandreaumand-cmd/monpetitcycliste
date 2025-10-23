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

    const { limit = 3 } = await req.json();

    // Get recent races with results
    const { data: recentCourses, error: coursesError } = await supabase
      .from('v_home_recent_results')
      .select('course_id, course_nom, date_fin, total_points')
      .order('date_fin', { ascending: false })
      .limit(limit);

    if (coursesError) throw coursesError;

    if (!recentCourses || recentCourses.length === 0) {
      return new Response(JSON.stringify({ races: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For each race, get top 10 from general classification
    const racesWithTop10 = await Promise.all(
      recentCourses.map(async (course) => {
        const { data: top10, error: topError } = await supabase.rpc('results_course_top', {
          p_course_id: course.course_id,
          p_type_classement: 'General',
          p_etape_numero: null,
          p_limit: 10
        });

        if (topError) {
          console.error(`Error fetching top 10 for ${course.course_id}:`, topError);
          return {
            ...course,
            top10: []
          };
        }

        return {
          course_id: course.course_id,
          course_nom: course.course_nom,
          date_fin: course.date_fin,
          total_points: course.total_points,
          top10: top10 || []
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
