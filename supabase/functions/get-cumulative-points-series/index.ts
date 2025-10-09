import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  saison_id?: string | null;
  phase_id?: string | null;
  view_mode?: 'current' | 'phase' | 'season';
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

    const { view_mode = 'current', phase_id, saison_id, topN = 10, manager_ids }: RequestBody = await req.json();

    console.log('get-cumulative-points-series called with:', { view_mode, phase_id, saison_id, topN, manager_ids });

    // Determine date range based on view_mode
    let startDate: Date;
    let endDate: Date = new Date();
    let targetPhaseId: string | null = null;
    let phaseInfo: any = null;

    if (view_mode === 'phase' && phase_id) {
      // Get phase dates
      const { data: phase } = await supabaseClient
        .from('phases')
        .select('date_debut, date_fin, index_dans_saison')
        .eq('id', phase_id)
        .single();
      
      if (phase) {
        startDate = new Date(phase.date_debut);
        endDate = new Date(phase.date_fin);
        targetPhaseId = phase_id;
        phaseInfo = { index: phase.index_dans_saison, date_debut: phase.date_debut, date_fin: phase.date_fin };
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
    } else if (view_mode === 'season' && saison_id) {
      // Get all phases for the season
      const { data: phases } = await supabaseClient
        .from('phases')
        .select('date_debut, date_fin')
        .eq('saison_id', saison_id)
        .order('date_debut', { ascending: true });
      
      if (phases && phases.length > 0) {
        startDate = new Date(phases[0].date_debut);
        endDate = new Date(phases[phases.length - 1].date_fin);
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
    } else {
      // Current mode - get active phase or default to 30 days
      const { data: activePhase } = await supabaseClient
        .from('phases')
        .select('id, date_debut, date_fin, index_dans_saison')
        .eq('statut', 'active')
        .order('date_debut', { ascending: false })
        .limit(1)
        .single();
      
      if (activePhase) {
        startDate = new Date(activePhase.date_debut);
        endDate = new Date(activePhase.date_fin);
        targetPhaseId = activePhase.id;
        phaseInfo = { index: activePhase.index_dans_saison, date_debut: activePhase.date_debut, date_fin: activePhase.date_fin };
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
    }

    // Get points with course dates
    let query = supabaseClient
      .from('points_ledger')
      .select(`
        manager_id,
        points,
        managers!inner(nom),
        courses!inner(date_fin, date_debut)
      `)
      .not('managers.nom', 'is', null)
      .neq('managers.nom', 'Unknown');

    if (targetPhaseId) {
      query = query.eq('phase_id', targetPhaseId);
    } else if (view_mode === 'season' && saison_id) {
      const { data: phaseIds } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phaseIds && phaseIds.length > 0) {
        const ids = phaseIds.map(p => p.id);
        query = query.in('phase_id', ids);
      }
    }

    const { data: pointsData, error: pointsError } = await query;

    if (pointsError) throw pointsError;

    // Aggregate points by manager and date (using course date)
    const pointsByManagerAndDate = new Map<string, Map<string, { points: number; nom: string }>>();
    const managerNames = new Map<string, string>();

    pointsData?.forEach((row: any) => {
      const courseDate = row.courses?.date_fin || row.courses?.date_debut;
      if (!courseDate) return;
      
      const date = new Date(courseDate).toISOString().split('T')[0];
      const dateObj = new Date(date);
      
      // Filter by date range
      if (dateObj < startDate || dateObj > endDate) return;
      
      const managerId = row.manager_id;
      const managerNom = row.managers?.nom;
      
      // Skip if no valid manager name
      if (!managerNom || managerNom === 'Unknown') return;
      
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
        view_mode,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        phase_info: phaseInfo,
        managers: selectedManagers.map(id => ({
          id,
          nom: managerNames.get(id)
        })).filter(m => m.nom && m.nom !== 'Unknown')
      },
      series: series.filter(s => s.manager_nom && s.manager_nom !== 'Unknown')
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
