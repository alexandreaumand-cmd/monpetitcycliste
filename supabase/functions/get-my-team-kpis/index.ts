import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  manager_id?: string | null;
  phase_id?: string | null;
  saison_id?: string | null;
  league_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: authHeader ? { authorization: authHeader } : {},
        },
      }
    );

    const { manager_id, phase_id, saison_id, league_id }: RequestBody = await req.json();

    console.log('get-my-team-kpis called with:', { manager_id, phase_id, saison_id, league_id });

    // Get current user's manager_id if not provided
    let actualManagerId = manager_id;
    if (!actualManagerId) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const { data: manager, error: managerError } = await supabaseClient
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (managerError || !manager) {
        throw new Error('Manager not found for current user');
      }
      
      actualManagerId = manager.id;
    }

    // Determine phase scope
    let phaseIds: string[] = [];
    if (phase_id) {
      phaseIds = [phase_id];
    } else if (saison_id) {
      const { data: phases } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      phaseIds = phases?.map(p => p.id) || [];
    } else {
      const { data: allPhases } = await supabaseClient
        .from('phases')
        .select('id');
      phaseIds = allPhases?.map(p => p.id) || [];
    }

    // Filter phaseIds by league's configured season if league_id provided
    if (league_id) {
      const { data: leagueScope } = await supabaseClient
        .from('league_scopes')
        .select('season_id')
        .eq('league_id', league_id)
        .single();

      if (leagueScope) {
        const { data: validPhases } = await supabaseClient
          .from('phases')
          .select('id')
          .eq('saison_id', leagueScope.season_id);

        const validPhaseIds = validPhases?.map(p => p.id) || [];
        phaseIds = phaseIds.filter(id => validPhaseIds.includes(id));
      }
    }

    if (phaseIds.length === 0) {
      return new Response(JSON.stringify({
        total_points: 0,
        top_rider_id: null,
        top_rider_nom: null,
        top_rider_points: null,
        my_rank: null,
        managers_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get league course scope and start date filters
    let allowedCourseIds: string[] | null = null;
    let leagueStartDate: string | null = null;
    
    if (league_id) {
      const { data: leagueCourses } = await supabaseClient.rpc('get_league_course_ids', { p_league_id: league_id });
      if (leagueCourses) {
        allowedCourseIds = leagueCourses.map((c: any) => c.course_id);
      }
      const { data: leagueData } = await supabaseClient
        .from('leagues')
        .select('started_at_effective')
        .eq('id', league_id)
        .single();
      if (leagueData?.started_at_effective) {
        leagueStartDate = leagueData.started_at_effective.split('T')[0];
      }
    }

    // Helper: filter course_id by league scope
    const isAllowedCourse = (courseId: string, courseDate?: string): boolean => {
      if (!league_id) return true;
      if (allowedCourseIds && !allowedCourseIds.includes(courseId)) return false;
      // started_at_effective filter is applied on points_ledger via course date lookup below
      return true;
    };

    // Get coureur_ids for this manager's roster
    let rostersQuery = supabaseClient
      .from('rosters')
      .select('coureur_id')
      .eq('manager_id', actualManagerId)
      .in('phase_id', phaseIds);
    
    if (league_id) {
      rostersQuery = rostersQuery.eq('league_id', league_id);
    }
    
    const { data: rosters, error: rostersError } = await rostersQuery;
    if (rostersError) throw rostersError;
    
    const coureurIds = rosters?.map(r => r.coureur_id) || [];
    
    if (coureurIds.length === 0) {
      return new Response(JSON.stringify({
        total_points: 0,
        top_rider_id: null,
        top_rider_nom: null,
        top_rider_points: null,
        my_rank: null,
        managers_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build list of allowed course IDs with date filtering
    let courseFilter: string[] | null = null;
    if (league_id && (allowedCourseIds || leagueStartDate)) {
      // Get courses with dates to apply started_at_effective filter
      let validIds = allowedCourseIds || [];
      if (leagueStartDate) {
        const { data: coursesWithDates } = await supabaseClient
          .from('courses')
          .select('id, date_debut')
          .in('phase_id', phaseIds);
        
        if (coursesWithDates) {
          const afterStart = coursesWithDates
            .filter(c => c.date_debut && c.date_debut >= leagueStartDate!)
            .map(c => c.id);
          
          if (allowedCourseIds) {
            courseFilter = allowedCourseIds.filter(id => afterStart.includes(id));
          } else {
            courseFilter = afterStart;
          }
        } else {
          courseFilter = allowedCourseIds;
        }
      } else {
        courseFilter = allowedCourseIds;
      }
    }

    // KPI #1: Get total points for these coureurs in scope
    let myPointsQuery = supabaseClient
      .from('points_ledger')
      .select('points, course_id')
      .in('phase_id', phaseIds)
      .in('coureur_id', coureurIds);
    
    if (courseFilter) {
      myPointsQuery = myPointsQuery.in('course_id', courseFilter);
    }

    const { data: myPoints, error: myPointsError } = await myPointsQuery;

    if (myPointsError) throw myPointsError;

    const race_points = myPoints?.reduce((sum, p) => sum + p.points, 0) || 0;

    // Ajouter les bonus manager
    let managerBonusQuery = supabaseClient
      .from('manager_bonus_points')
      .select('bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs')
      .eq('manager_id', actualManagerId)
      .in('phase_id', phaseIds);
    
    if (league_id) {
      managerBonusQuery = managerBonusQuery.eq('league_id', league_id);
    }
    
    const { data: managerBonus } = await managerBonusQuery;

    const managerBonusTotal = managerBonus?.reduce((sum, mb) => 
      sum + (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + (mb.bonus_first_win || 0) + 
      (mb.bonus_coureurs || 0) + (mb.bonus_scoreurs || 0), 0) || 0;

    // Ajouter les bonus coureur bonusé
    let riderBonusQuery = supabaseClient
      .from('bonus_points')
      .select('points')
      .eq('manager_id', actualManagerId)
      .in('phase_id', phaseIds)
      .eq('bonus_type', 'coureur_bonuse');
    
    if (league_id) {
      riderBonusQuery = riderBonusQuery.eq('league_id', league_id);
    }
    
    const { data: riderBonus } = await riderBonusQuery;

    const riderBonusTotal = riderBonus?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

    // Ajouter les bonus reçus d'autres managers
    let receivedBonusQuery = supabaseClient
      .from('bonus_points')
      .select('points')
      .eq('target_manager_id', actualManagerId)
      .in('phase_id', phaseIds);
    
    if (league_id) {
      receivedBonusQuery = receivedBonusQuery.eq('league_id', league_id);
    }
    
    const { data: receivedBonus } = await receivedBonusQuery;

    const receivedBonusTotal = receivedBonus?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

    // TOTAL aligné avec v_manager_standings
    const total_points = race_points + managerBonusTotal + riderBonusTotal + receivedBonusTotal;

    // KPI #2: Get top rider for this manager in scope
    let topRiderQuery = supabaseClient
      .from('points_ledger')
      .select('coureur_id, points')
      .in('phase_id', phaseIds)
      .in('coureur_id', coureurIds);
    
    if (courseFilter) {
      topRiderQuery = topRiderQuery.in('course_id', courseFilter);
    }

    const { data: pointsByRider, error: riderPointsError } = await topRiderQuery;

    if (riderPointsError) throw riderPointsError;

    const riderTotals = new Map<string, number>();
    pointsByRider?.forEach(p => {
      riderTotals.set(p.coureur_id, (riderTotals.get(p.coureur_id) || 0) + p.points);
    });

    const topRiderEntry = Array.from(riderTotals.entries())
      .sort((a, b) => b[1] - a[1])[0];

    let top_rider_id: string | null = null;
    let top_rider_nom: string | null = null;
    let top_rider_points: number | null = null;

    if (topRiderEntry) {
      top_rider_id = topRiderEntry[0];
      top_rider_points = topRiderEntry[1];

      const { data: coureur } = await supabaseClient
        .from('coureurs')
        .select('nom')
        .eq('id', top_rider_id)
        .single();

      top_rider_nom = coureur?.nom || null;
    }

    // KPI #3: Get manager's rank in scope using the appropriate view
    let standingsView = '';
    let standingsFilter: any = {};
    
    if (phase_id) {
      standingsView = 'v_manager_standings_by_phase_v2';
      standingsFilter = { phase_id };
    } else if (saison_id) {
      standingsView = 'v_manager_standings_by_season_v2';
      standingsFilter = { saison_id };
    } else {
      // Fallback: use all phases aggregation
      standingsView = 'v_manager_standings_by_phase_v2';
    }
    
    let standingsQuery = supabaseClient
      .from(standingsView)
      .select('manager_id, total_points')
      .order('total_points', { ascending: false });
    
    if (league_id) {
      standingsQuery = standingsQuery.eq('league_id', league_id);
    }
    
    if (standingsFilter.phase_id) {
      standingsQuery = standingsQuery.eq('phase_id', standingsFilter.phase_id);
    } else if (standingsFilter.saison_id) {
      standingsQuery = standingsQuery.eq('saison_id', standingsFilter.saison_id);
    }
    
    const { data: standings, error: standingsError } = await standingsQuery;
    
    if (standingsError) {
      console.error('Error fetching standings:', standingsError);
      // Fallback to 0
      return new Response(JSON.stringify({
        total_points,
        top_rider_id,
        top_rider_nom,
        top_rider_points,
        my_rank: null,
        managers_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const managers_count = standings?.length || 0;
    const my_rank = standings?.findIndex(s => s.manager_id === actualManagerId) + 1 || 0;

    const response = {
      total_points,
      top_rider_id,
      top_rider_nom,
      top_rider_points,
      my_rank: my_rank > 0 ? my_rank : null,
      managers_count
    };

    console.log('Returning my team KPIs:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-my-team-kpis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
