import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-cumulative-points-series function loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { saison_id, phase_id, range = '30d', topN = 5, manager_ids } = await req.json();

    console.log('Fetching cumulative points series:', { saison_id, phase_id, range, topN, manager_ids });

    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 6);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 29);
        break;
      case '2m':
        startDate.setMonth(endDate.getMonth() - 2);
        startDate.setDate(startDate.getDate() + 1);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        startDate.setDate(startDate.getDate() + 1);
        break;
      case 'ytd':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 29);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log('Date range:', { startDateStr, endDateStr });

    // Build query for points ledger
    let query = supabase
      .from('points_ledger')
      .select('manager_id, created_at, points, phase_id')
      .gte('created_at', startDateStr)
      .lte('created_at', endDateStr);

    // Apply phase/saison filters
    if (phase_id) {
      query = query.eq('phase_id', phase_id);
    } else if (saison_id) {
      const { data: phases } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        query = query.in('phase_id', phaseIds);
      }
    }

    const { data: pointsData, error: pointsError } = await query;

    if (pointsError) {
      console.error('Error fetching points:', pointsError);
      throw pointsError;
    }

    // Aggregate points by manager and day
    const dailyPoints = new Map<string, Map<string, number>>();
    const managerTotals = new Map<string, number>();

    pointsData?.forEach((point: any) => {
      const managerId = point.manager_id;
      const date = new Date(point.created_at).toISOString().split('T')[0];
      const pts = point.points || 0;

      if (!dailyPoints.has(managerId)) {
        dailyPoints.set(managerId, new Map());
      }
      
      const managerDailyMap = dailyPoints.get(managerId)!;
      managerDailyMap.set(date, (managerDailyMap.get(date) || 0) + pts);

      managerTotals.set(managerId, (managerTotals.get(managerId) || 0) + pts);
    });

    // Determine which managers to display
    let selectedManagerIds: string[];
    
    if (manager_ids && manager_ids.length > 0) {
      selectedManagerIds = manager_ids;
    } else {
      // Get top N managers by total points in the period
      const sorted = Array.from(managerTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([id]) => id);
      selectedManagerIds = sorted;
    }

    // Fetch manager names
    const { data: managersData, error: managersError } = await supabase
      .from('managers')
      .select('id, nom')
      .in('id', selectedManagerIds);

    if (managersError) {
      console.error('Error fetching managers:', managersError);
    }

    const managerNames = new Map(managersData?.map(m => [m.id, m.nom]) || []);

    // Generate complete date range
    const allDates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Build cumulative series for each manager
    const series = selectedManagerIds.map(managerId => {
      const managerDailyMap = dailyPoints.get(managerId) || new Map();
      let cumulative = 0;

      const points = allDates.map(date => {
        const dailyPts = managerDailyMap.get(date) || 0;
        cumulative += dailyPts;
        return {
          date,
          value: cumulative,
        };
      });

      return {
        manager_id: managerId,
        manager_nom: managerNames.get(managerId) || 'Inconnu',
        points,
      };
    });

    const meta = {
      start_date: startDateStr,
      end_date: endDateStr,
      managers: selectedManagerIds.map(id => ({
        id,
        nom: managerNames.get(id) || 'Inconnu',
      })),
    };

    console.log(`Returning ${series.length} series with ${allDates.length} data points each`);

    return new Response(JSON.stringify({ meta, series }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-cumulative-points-series:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
