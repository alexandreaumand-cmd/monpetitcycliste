import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  manager_id?: string | null;
  phase_id?: string | null;
  saison_id?: string | null;
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

    const { manager_id, phase_id, saison_id }: RequestBody = await req.json();

    console.log('get-my-team-kpis called with:', { manager_id, phase_id, saison_id });

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

    // KPI #1: Get total points for this manager in scope
    const { data: myPoints, error: myPointsError } = await supabaseClient
      .from('points_ledger')
      .select('points')
      .eq('manager_id', actualManagerId)
      .in('phase_id', phaseIds);

    if (myPointsError) throw myPointsError;

    const total_points = myPoints?.reduce((sum, p) => sum + p.points, 0) || 0;

    // KPI #2: Get top rider for this manager in scope
    const { data: pointsByRider, error: riderPointsError } = await supabaseClient
      .from('points_ledger')
      .select('coureur_id, points')
      .eq('manager_id', actualManagerId)
      .in('phase_id', phaseIds);

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

    // KPI #3: Get manager's rank in scope
    const { data: allManagerPoints, error: leaderboardError } = await supabaseClient
      .from('points_ledger')
      .select('manager_id, points')
      .in('phase_id', phaseIds);

    if (leaderboardError) throw leaderboardError;

    const managerTotals = new Map<string, number>();
    allManagerPoints?.forEach(p => {
      managerTotals.set(p.manager_id, (managerTotals.get(p.manager_id) || 0) + p.points);
    });

    const leaderboard = Array.from(managerTotals.entries())
      .map(([manager_id, points]) => ({ manager_id, points }))
      .sort((a, b) => b.points - a.points);

    const managers_count = leaderboard.length;
    const my_rank = leaderboard.findIndex(m => m.manager_id === actualManagerId) + 1;

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
