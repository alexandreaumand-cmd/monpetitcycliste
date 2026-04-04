import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  course_id: string;
  type_classement?: 'Etape' | 'General' | 'Points' | 'Montagne' | 'Jeune' | null;
  etape_numero?: number | null;
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
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { course_id, type_classement, etape_numero, league_id }: RequestBody = await req.json();

    if (!course_id) {
      throw new Error('course_id is required');
    }

    console.log('Exporting leaderboard CSV for course:', course_id);

    // Get course details to retrieve phase_id
    const { data: course, error: courseError } = await supabaseClient
      .from('courses')
      .select('phase_id, nom')
      .eq('id', course_id)
      .single();

    if (courseError) throw courseError;

    // Fetch global points for this course
    let pointsQuery = supabaseClient
      .from('points_ledger')
      .select('coureur_id, points')
      .eq('course_id', course_id)
      .eq('phase_id', course.phase_id);

    if (type_classement) {
      pointsQuery = pointsQuery.eq('type_classement', type_classement);
      if (type_classement === 'Etape' && etape_numero) {
        pointsQuery = pointsQuery.eq('etape_numero', etape_numero);
      }
    }

    const { data: pointsData, error: pointsError } = await pointsQuery;
    if (pointsError) throw pointsError;

    // Retrieve target league (default to Legacy League)
    const targetLeagueId = league_id || 'f7921741-29f4-4296-9aca-a03c1f3615b0';

    // Get rosters for this phase and league
    const { data: rostersData, error: rostersError } = await supabaseClient
      .from('rosters')
      .select('coureur_id, manager_id')
      .eq('phase_id', course.phase_id)
      .eq('league_id', targetLeagueId);

    if (rostersError) throw rostersError;

    // Create map coureur_id -> manager_id
    const coureurToManager = new Map<string, string>();
    for (const roster of rostersData || []) {
      coureurToManager.set(roster.coureur_id, roster.manager_id);
    }

    // Aggregate by manager
    const managerPoints = new Map<string, number>();
    for (const point of pointsData || []) {
      const manager_id = coureurToManager.get(point.coureur_id);
      if (!manager_id) continue;
      const current = managerPoints.get(manager_id) || 0;
      managerPoints.set(manager_id, current + point.points);
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
