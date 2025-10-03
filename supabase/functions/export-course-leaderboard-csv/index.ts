import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  course_id: string;
  type_classement?: 'Etape' | 'General' | 'Points' | 'Montagne' | 'Jeune' | null;
  etape_numero?: number | null;
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
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { course_id, type_classement, etape_numero }: RequestBody = await req.json();

    if (!course_id) {
      throw new Error('course_id is required');
    }

    console.log('Exporting leaderboard CSV for course:', course_id);

    // Get course info
    const { data: course, error: courseError } = await supabaseClient
      .from('courses')
      .select('nom')
      .eq('id', course_id)
      .single();

    if (courseError) throw courseError;

    // Build points query
    let pointsQuery = supabaseClient
      .from('points_ledger')
      .select('manager_id, coureur_id, points')
      .eq('course_id', course_id);

    if (type_classement) {
      pointsQuery = pointsQuery.eq('type_classement', type_classement);
      if (type_classement === 'Etape' && etape_numero) {
        pointsQuery = pointsQuery.eq('etape_numero', etape_numero);
      }
    }

    const { data: pointsData, error: pointsError } = await pointsQuery;

    if (pointsError) throw pointsError;

    // Aggregate by manager
    const managerPoints = new Map<string, number>();
    for (const point of pointsData || []) {
      const current = managerPoints.get(point.manager_id) || 0;
      managerPoints.set(point.manager_id, current + point.points);
    }

    // Get manager names
    const managerIds = Array.from(managerPoints.keys());
    const { data: managers } = await supabaseClient
      .from('managers')
      .select('id, nom')
      .in('id', managerIds);

    const managerMap = new Map(managers?.map(m => [m.id, m.nom]) || []);

    // Build and sort leaderboard
    const leaderboard = Array.from(managerPoints.entries())
      .map(([manager_id, points]) => ({
        manager_nom: managerMap.get(manager_id) || 'Unknown',
        points
      }))
      .sort((a, b) => b.points - a.points)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));

    // Generate CSV
    const csvLines = [
      'Rang,Manager,Points',
      ...leaderboard.map(row => `${row.rank},${row.manager_nom},${row.points}`)
    ];

    const csv = csvLines.join('\n');
    const filename = `classement_${course.nom.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`;

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      status: 200
    });

  } catch (error) {
    console.error('Error in export-course-leaderboard-csv:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
