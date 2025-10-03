import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  saison_id?: string | null;
  phase_id?: string | null;
  days: number;
  topN?: number | null;
  manager_ids?: string[] | null;
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
        auth: {
          persistSession: false,
        },
      }
    );

    const { days, phase_id, saison_id, topN = 5, manager_ids }: RequestBody = await req.json();

    console.log('get-cumulative-points-series called with:', { days, phase_id, saison_id, topN, manager_ids });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));

    // Build the WHERE clause for points_ledger
    let whereConditions = `created_at >= '${startDate.toISOString()}' AND created_at <= '${endDate.toISOString()}'`;
    
    if (phase_id) {
      whereConditions += ` AND phase_id = '${phase_id}'`;
    } else if (saison_id) {
      // Need to join with phases to filter by saison
      const { data: phaseIds } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phaseIds && phaseIds.length > 0) {
        const ids = phaseIds.map(p => `'${p.id}'`).join(',');
        whereConditions += ` AND phase_id IN (${ids})`;
      }
    }

    // Get daily points per manager
    const { data: dailyPoints, error: dailyError } = await supabaseClient
      .from('points_ledger')
      .select('manager_id, created_at, points, managers(nom)')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (dailyError) throw dailyError;

    // Aggregate points by manager and date
    const pointsByManagerAndDate = new Map<string, Map<string, { points: number; nom: string }>>();
    const managerNames = new Map<string, string>();

    dailyPoints?.forEach((row: any) => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      const managerId = row.manager_id;
      const managerNom = row.managers?.nom || 'Unknown';
      
      managerNames.set(managerId, managerNom);

      if (!pointsByManagerAndDate.has(managerId)) {
        pointsByManagerAndDate.set(managerId, new Map());
      }
      
      const dateMap = pointsByManagerAndDate.get(managerId)!;
      const existing = dateMap.get(date) || { points: 0, nom: managerNom };
      existing.points += row.points;
      dateMap.set(date, existing);
    });

    // Determine which managers to display
    let selectedManagers: string[] = [];
    
    if (manager_ids && manager_ids.length > 0) {
      selectedManagers = manager_ids;
    } else {
      // Get top N managers by total points in period
      const managerTotals = Array.from(pointsByManagerAndDate.entries()).map(([managerId, dateMap]) => {
        const total = Array.from(dateMap.values()).reduce((sum, d) => sum + d.points, 0);
        return { managerId, total };
      });
      
      managerTotals.sort((a, b) => b.total - a.total);
      selectedManagers = managerTotals.slice(0, topN || 5).map(m => m.managerId);
    }

    // Generate all dates in range
    const allDates: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      allDates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Build cumulative series for each selected manager
    const series = selectedManagers.map(managerId => {
      const dateMap = pointsByManagerAndDate.get(managerId) || new Map();
      const managerNom = managerNames.get(managerId) || 'Unknown';
      
      let cumulative = 0;
      const points = allDates.map(date => {
        const dailyData = dateMap.get(date);
        cumulative += dailyData?.points || 0;
        return {
          date,
          value: cumulative
        };
      });

      return {
        manager_id: managerId,
        manager_nom: managerNom,
        points
      };
    });

    const response = {
      meta: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        managers: selectedManagers.map(id => ({
          id,
          nom: managerNames.get(id) || 'Unknown'
        }))
      },
      series
    };

    console.log('Returning cumulative series:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-cumulative-points-series:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
