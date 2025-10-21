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

    const { course_ids, saison_id, league_id } = await req.json();

    if (!course_ids || !Array.isArray(course_ids) || course_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'course_ids array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get phases for the season to filter points correctly
    let phaseIds: string[] = [];
    if (saison_id) {
      const { data: phases, error: phasesError } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phasesError) throw phasesError;
      phaseIds = phases?.map(p => p.id) || [];
    }

    // Get manager IDs for the league
    let managerIds: string[] | null = null;
    if (league_id && phaseIds.length > 0) {
      const { data: rostersData, error: rostersError } = await supabase
        .from('rosters')
        .select('manager_id')
        .eq('league_id', league_id)
        .in('phase_id', phaseIds);
      
      if (rostersError) throw rostersError;
      managerIds = [...new Set(rostersData?.map(r => r.manager_id) || [])];
      
      // If no managers found, return empty
      if (managerIds.length === 0) {
        return new Response(JSON.stringify({ podiums: {}, winners: {} }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get all points filtered by managers
    let allPointsQuery = supabase
      .from('points_ledger')
      .select('course_id, manager_id, points')
      .in('course_id', course_ids);
    
    if (managerIds) {
      allPointsQuery = allPointsQuery.in('manager_id', managerIds);
    }
    
    if (phaseIds.length > 0) {
      allPointsQuery = allPointsQuery.in('phase_id', phaseIds);
    }

    const { data: allPoints, error: pointsError } = await allPointsQuery;

    if (pointsError) throw pointsError;

    // Get manager names separately
    const uniqueManagerIds = [...new Set(allPoints?.map(p => p.manager_id) || [])];
    const { data: managersData, error: managersError } = await supabase
      .from('managers')
      .select('id, nom')
      .in('id', uniqueManagerIds);

    if (managersError) throw managersError;

    const managersMap = new Map(managersData?.map(m => [m.id, m.nom]) || []);

    // Aggregate points by course and manager
    const aggregated: Record<string, Record<string, { manager_nom: string; points: number }>> = {};

    allPoints?.forEach((row: any) => {
      const courseId = row.course_id;
      const managerId = row.manager_id;
      const managerNom = managersMap.get(managerId) || 'Unknown';
      const points = row.points || 0;

      if (!aggregated[courseId]) {
        aggregated[courseId] = {};
      }
      if (!aggregated[courseId][managerId]) {
        aggregated[courseId][managerId] = { manager_nom: managerNom, points: 0 };
      }
      aggregated[courseId][managerId].points += points;
    });

    // Convert to array format and sort
    const podiumResult: Record<string, Array<{ manager_id: string; manager_nom: string; points: number; rank: number }>> = {};

    Object.keys(aggregated).forEach(courseId => {
      const managers = Object.entries(aggregated[courseId])
        .sort((a, b) => b[1].points - a[1].points)
        .slice(0, 3)
        .map(([managerId, data], idx) => ({
          manager_id: managerId,
          manager_nom: data.manager_nom,
          points: data.points,
          rank: idx + 1
        }));
      podiumResult[courseId] = managers;
    });

    // Get course dates for season filtering
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, date_debut, date_fin, phase_id')
      .in('id', course_ids);

    if (coursesError) throw coursesError;

    // Filter courses by season phases if provided
    const relevantCourses = saison_id && phaseIds.length > 0
      ? coursesData?.filter(c => c.phase_id && phaseIds.includes(c.phase_id))
      : coursesData;

    const relevantCourseIds = relevantCourses?.map(c => c.id) || [];

    // Get winners (top rider in General or Etape classification) - season-aware
    const { data: winnersData, error: winnersError } = await supabase
      .from('race_results')
      .select(`
        course_id,
        type_classement,
        position,
        coureur_id,
        date_classement,
        etape_numero,
        coureurs!inner(nom)
      `)
      .in('course_id', relevantCourseIds)
      .eq('position', 1)
      .in('type_classement', ['General', 'Etape']);

    if (winnersError) throw winnersError;

    // Process winners: prefer General, fallback to highest Etape within course dates
    const winnersResult: Record<string, { coureur_nom: string }> = {};
    
    winnersData?.forEach((row: any) => {
      const courseId = row.course_id;
      const classType = row.type_classement;
      const coureurNom = row.coureurs?.nom;
      const dateClassement = row.date_classement;
      const etapeNumero = row.etape_numero;

      if (!coureurNom) return;

      const course = relevantCourses?.find(c => c.id === courseId);
      if (!course) return;

      // Check if result is within course dates
      const isWithinDates = (!course.date_debut || dateClassement >= course.date_debut) &&
                           (!course.date_fin || dateClassement <= course.date_fin);
      
      if (!isWithinDates) return;

      // Prefer General, or highest stage number for Etape
      if (!winnersResult[courseId]) {
        winnersResult[courseId] = { coureur_nom: coureurNom };
      } else if (classType === 'General') {
        winnersResult[courseId] = { coureur_nom: coureurNom };
      } else if (classType === 'Etape' && winnersResult[courseId].coureur_nom !== coureurNom) {
        // Only update if current is also Etape (don't override General)
        const currentWinner = winnersData.find((w: any) => 
          w.course_id === courseId && w.coureurs?.nom === winnersResult[courseId].coureur_nom
        );
        if (currentWinner?.type_classement === 'Etape' && 
            etapeNumero > currentWinner.etape_numero) {
          winnersResult[courseId] = { coureur_nom: coureurNom };
        }
      }
    });

    return new Response(JSON.stringify({ podiums: podiumResult, winners: winnersResult }), {
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
