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

    const { course_ids } = await req.json();

    if (!course_ids || !Array.isArray(course_ids) || course_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'course_ids array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get top 3 managers for each course
    const { data: podiums, error } = await supabase
      .from('points_ledger')
      .select(`
        course_id,
        manager_id,
        managers!inner(nom)
      `)
      .in('course_id', course_ids);

    if (error) throw error;

    // Aggregate points by course and manager
    const aggregated: Record<string, Record<string, { manager_nom: string; points: number }>> = {};

    podiums?.forEach((row: any) => {
      const courseId = row.course_id;
      const managerId = row.manager_id;
      const managerNom = row.managers.nom;

      if (!aggregated[courseId]) {
        aggregated[courseId] = {};
      }
      if (!aggregated[courseId][managerId]) {
        aggregated[courseId][managerId] = { manager_nom: managerNom, points: 0 };
      }
    });

    // Now sum the actual points
    const { data: pointsData, error: pointsError } = await supabase
      .from('points_ledger')
      .select('course_id, manager_id, points')
      .in('course_id', course_ids);

    if (pointsError) throw pointsError;

    pointsData?.forEach((row: any) => {
      const courseId = row.course_id;
      const managerId = row.manager_id;
      if (aggregated[courseId]?.[managerId]) {
        aggregated[courseId][managerId].points += row.points;
      }
    });

    // Convert to array format and sort
    const result: Record<string, Array<{ manager_nom: string; points: number; rank: number }>> = {};

    Object.keys(aggregated).forEach(courseId => {
      const managers = Object.values(aggregated[courseId])
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map((m, idx) => ({
          manager_nom: m.manager_nom,
          points: m.points,
          rank: idx + 1
        }));
      result[courseId] = managers;
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-courses-podiums:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
