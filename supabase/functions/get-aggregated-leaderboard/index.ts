import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  saison_id?: string | null;
  phase_id?: string | null;
  filters?: string[] | null;
  league_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { saison_id, phase_id, filters, league_id }: RequestBody = await req.json();

    if (!league_id) {
      return new Response(
        JSON.stringify({ error: 'league_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Getting aggregated leaderboard:', { saison_id, phase_id, filters, league_id });

    // Step 1: Get league's configured season and filter courses by league_scopes
    const { data: leagueScope, error: scopeError } = await supabaseClient
      .from('league_scopes')
      .select('season_id')
      .eq('league_id', league_id)
      .single();

    if (scopeError || !leagueScope) {
      return new Response(
        JSON.stringify({ 
          error: 'League scope not configured',
          leaderboard: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get valid phases for this league's season
    const { data: validPhases } = await supabaseClient
      .from('phases')
      .select('id')
      .eq('saison_id', leagueScope.season_id);

    const validPhaseIds = validPhases?.map(p => p.id) || [];

    if (validPhaseIds.length === 0) {
      return new Response(
        JSON.stringify({ leaderboard: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Build courses filter conditions
    const uciCategories = filters?.filter(f => !['GT', 'Monument', 'WT_Tours', 'WT_Classiques'].includes(f)) || [];
    const wtFilters = filters?.filter(f => ['GT', 'Monument', 'WT_Tours', 'WT_Classiques'].includes(f)) || [];

    // Build query for points_ledger with courses join, filtered by league's valid phases
    let coursesQuery = supabaseClient
      .from('courses')
      .select('id')
      .in('phase_id', validPhaseIds);

    // Apply additional filters if provided
    if (phase_id) {
      if (!validPhaseIds.includes(phase_id)) {
        return new Response(
          JSON.stringify({ leaderboard: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      coursesQuery = coursesQuery.eq('phase_id', phase_id);
    } else if (saison_id) {
      const { data: requestedPhases } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      const requestedPhaseIds = requestedPhases?.map(p => p.id) || [];
      const intersection = validPhaseIds.filter(id => requestedPhaseIds.includes(id));
      
      if (intersection.length > 0) {
        coursesQuery = coursesQuery.in('phase_id', intersection);
      } else {
        return new Response(
          JSON.stringify({ leaderboard: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Apply category/wt_tier filters
    const conditions: string[] = [];
    if (uciCategories.length > 0) {
      conditions.push(`categorie.in.(${uciCategories.join(',')})`);
    }
    if (wtFilters.includes('GT')) {
      conditions.push('wt_tier.eq.GT');
    }
    if (wtFilters.includes('Monument')) {
      conditions.push('wt_tier.eq.Monument');
    }
    if (wtFilters.includes('WT_Tours')) {
      conditions.push('wt_tier.ilike.WT_Tours_%');
    }
    if (wtFilters.includes('WT_Classiques')) {
      conditions.push('wt_tier.ilike.WT_Classiques_%');
    }

    if (conditions.length > 0) {
      coursesQuery = coursesQuery.or(conditions.join(','));
    }

    const { data: courseIds, error: coursesError } = await coursesQuery;
    if (coursesError) throw coursesError;

    const courseIdList = courseIds?.map(c => c.id) || [];
    console.log('Filtered courses count:', courseIdList.length);

    if (courseIdList.length === 0) {
      return new Response(
        JSON.stringify({ leaderboard: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get points data
    let pointsQuery = supabaseClient
      .from('points_ledger')
      .select('manager_id, coureur_id, course_id, points, type_classement, etape_numero')
      .in('course_id', courseIdList)
      .eq('league_id', league_id)
      .not('manager_id', 'is', null);

    const { data: pointsData, error: pointsError } = await pointsQuery;
    if (pointsError) throw pointsError;

    console.log('Points records:', pointsData?.length || 0);

    // Aggregate by manager
    const managerStats = new Map<string, {
      total_points: number;
      courses: Set<string>;
      victories: number;
    }>();

    for (const point of pointsData || []) {
      if (!managerStats.has(point.manager_id)) {
        managerStats.set(point.manager_id, {
          total_points: 0,
          courses: new Set(),
          victories: 0
        });
      }
      const stats = managerStats.get(point.manager_id)!;
      stats.total_points += point.points;
      stats.courses.add(point.course_id);
    }

    // Get race results to count victories
    const { data: victories, error: victoriesError } = await supabaseClient
      .from('race_results')
      .select('course_id, coureur_id')
      .in('course_id', courseIdList)
      .eq('position', 1)
      .eq('statut', 'finished')
      .or('type_classement.eq.Etape,etape_numero.is.null');

    if (!victoriesError && victories) {
      // Match victories to managers via rosters
      const coureurIds = Array.from(new Set(victories.map(v => v.coureur_id)));
      
      if (coureurIds.length > 0) {
        const { data: rosters } = await supabaseClient
          .from('rosters')
          .select('manager_id, coureur_id, phase_id')
          .in('coureur_id', coureurIds)
          .eq('league_id', league_id);

        for (const victory of victories) {
          const roster = rosters?.find(r => 
            r.coureur_id === victory.coureur_id && 
            courseIds?.some(c => c.id === victory.course_id)
          );
          
          if (roster && managerStats.has(roster.manager_id)) {
            managerStats.get(roster.manager_id)!.victories++;
          }
        }
      }
    }

    // Get manager names (filtered by league membership)
    const managerIds = Array.from(managerStats.keys());
    const { data: leagueMembers } = await supabaseClient
      .from('league_members')
      .select('manager_id')
      .eq('league_id', league_id)
      .in('manager_id', managerIds);
    
    const validManagerIds = leagueMembers?.map(lm => lm.manager_id) || [];
    const { data: managers } = await supabaseClient
      .from('managers')
      .select('id, nom')
      .in('id', validManagerIds);

    const managerMap = new Map(managers?.map(m => [m.id, m.nom]) || []);

    // Build leaderboard
    const leaderboard = Array.from(managerStats.entries())
      .map(([manager_id, stats]) => ({
        manager_id,
        manager_nom: managerMap.get(manager_id) || 'Unknown',
        total_points: stats.total_points,
        courses_count: stats.courses.size,
        victories_count: stats.victories
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));

    return new Response(
      JSON.stringify({ leaderboard }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in get-aggregated-leaderboard:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
