import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

interface PhasePoints {
  phase_id: string;
  phase_index: number;
  manager_id: string;
  manager_nom: string;
  points: number;
}

interface PhaseStats {
  phase_id: string;
  phase_index: number;
  phase_label: string;
  stats: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    mean: number;
    std_dev: number;
    iqr: number;
    outliers_low: Array<{ manager_id: string; manager_nom: string; points: number }>;
    outliers_high: Array<{ manager_id: string; manager_nom: string; points: number }>;
  };
  all_points: Array<{ manager_id: string; manager_nom: string; points: number }>;
}

function calculateStats(points: number[], allPoints: PhasePoints[]) {
  const sorted = [...points].sort((a, b) => a - b);
  const n = sorted.length;

  if (n === 0) {
    return {
      min: 0, q1: 0, median: 0, q3: 0, max: 0,
      mean: 0, std_dev: 0, iqr: 0,
      outliers_low: [], outliers_high: []
    };
  }

  const q1 = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const std_dev = Math.sqrt(variance);

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers_low = allPoints.filter(p => p.points < lowerBound)
    .map(p => ({ manager_id: p.manager_id, manager_nom: p.manager_nom, points: p.points }));
  const outliers_high = allPoints.filter(p => p.points > upperBound)
    .map(p => ({ manager_id: p.manager_id, manager_nom: p.manager_nom, points: p.points }));

  return {
    min: Math.round(min),
    q1: Math.round(q1),
    median: Math.round(median),
    q3: Math.round(q3),
    max: Math.round(max),
    mean: Math.round(mean),
    std_dev: Math.round(std_dev),
    iqr: Math.round(iqr),
    outliers_low,
    outliers_high
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { saison_id: saisonId, league_id } = await req.json();

    if (!saisonId || !league_id) {
      return new Response(
        JSON.stringify({ error: 'saison_id and league_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-points-distribution] Fetching distribution for saison: ${saisonId}, league: ${league_id}`);

    // Check if this is the Legacy League
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', league_id)
      .single();

    const isLegacy = leagueData?.name?.toLowerCase().includes('legacy') || false;
    console.log(`[get-points-distribution] isLegacy: ${isLegacy}`);

    // Access control for non-Legacy leagues
    if (!isLegacy) {
      const { data: membership } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', league_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: 'Access denied: you are not a member of this league' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Récupérer toutes les phases de la saison
    const { data: allPhases, error: phasesError } = await supabase
      .from('phases')
      .select('id, index_dans_saison')
      .eq('saison_id', saisonId)
      .order('index_dans_saison');

    if (phasesError) throw phasesError;
    if (!allPhases || allPhases.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No phases found for this season' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter phases by league scope
    const { data: scopeData } = await supabase
      .from('league_scopes')
      .select('phases')
      .eq('league_id', league_id)
      .single();
    const scopedPhaseIds = scopeData?.phases || [];
    const phases = scopedPhaseIds.length > 0
      ? allPhases.filter(p => scopedPhaseIds.includes(p.id))
      : allPhases;

    console.log(`[get-points-distribution] Found ${phases.length} phases`);

    // Fetch managers based on league type
    let managers: Array<{ id: string; nom: string; user_id: string }> | null = null;
    if (isLegacy) {
      // For Legacy: get managers from rosters
      const phaseIds = phases.map(p => p.id);
      const { data: rosterManagers, error: rostersError } = await supabase
        .from('rosters')
        .select('manager_id')
        .eq('league_id', league_id)
        .in('phase_id', phaseIds);

      if (rostersError) throw rostersError;

      const managerIds = [...new Set(rosterManagers?.map(r => r.manager_id) || [])];
      
      const { data: managersData, error: managersError } = await supabase
        .from('managers')
        .select('id, nom, user_id')
        .in('id', managerIds)
        .order('nom');

      if (managersError) throw managersError;
      managers = managersData;
    } else {
      // For private leagues: get managers from league_members
      const { data: leagueManagers, error: leagueMembersError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', league_id);

      if (leagueMembersError) throw leagueMembersError;

      const userIds = leagueManagers?.map(lm => lm.user_id) || [];
      
      if (userIds.length === 0) {
        managers = [];
      } else {
        const { data: managersData, error: managersError } = await supabase
          .from('managers')
          .select('id, nom, user_id')
          .in('user_id', userIds)
          .order('nom');

        if (managersError) throw managersError;
        managers = managersData;
      }
    }

    console.log(`[get-points-distribution] Found ${managers?.length || 0} managers`);

    // Pour chaque phase, calculer les points de chaque manager
    const phaseStatsPromises = phases.map(async (phase) => {
      // Get all rosters for this phase in this league
      const { data: rosters } = await supabase
        .from('rosters')
        .select('manager_id, coureur_id')
        .eq('phase_id', phase.id)
        .eq('league_id', league_id);

      // Get all race points for riders in these rosters
      const allCoureurIds = [...new Set(rosters?.map(r => r.coureur_id) || [])];
      
      let racePointsData: { coureur_id: string; points: number }[] = [];
      if (allCoureurIds.length > 0) {
        const { data: racePoints } = await supabase
          .from('points_ledger')
          .select('coureur_id, points')
          .eq('phase_id', phase.id)
          .in('coureur_id', allCoureurIds);
        racePointsData = racePoints || [];
      }

      // Bonus managers
      const { data: managerBonus } = await supabase
        .from('manager_bonus_points')
        .select('manager_id, bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs')
        .eq('phase_id', phase.id)
        .eq('league_id', league_id);

      // Bonus coureurs
      const { data: riderBonus } = await supabase
        .from('bonus_points')
        .select('manager_id, target_manager_id, points')
        .eq('phase_id', phase.id)
        .eq('league_id', league_id);

      // Calculer les totaux par manager
      const managerTotals = new Map<string, { manager_id: string; points: number }>();

      // Initialiser avec 0 pour tous les managers
      managers?.forEach(m => {
        managerTotals.set(m.id, { manager_id: m.id, points: 0 });
      });

      // Map race points to managers via rosters
      rosters?.forEach(roster => {
        const riderPoints = racePointsData.filter(rp => rp.coureur_id === roster.coureur_id);
        const totalRiderPoints = riderPoints.reduce((sum, rp) => sum + (rp.points || 0), 0);
        
        const current = managerTotals.get(roster.manager_id);
        if (current) {
          current.points += totalRiderPoints;
        }
      });

      // Ajouter les bonus managers
      managerBonus?.forEach(mb => {
        const current = managerTotals.get(mb.manager_id);
        if (current) {
          current.points += (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
                           (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + 
                           (mb.bonus_scoreurs || 0);
        }
      });

      // Ajouter les bonus coureurs
      riderBonus?.forEach(rb => {
        const targetId = rb.target_manager_id || rb.manager_id;
        if (targetId) {
          const current = managerTotals.get(targetId);
          if (current) {
            current.points += rb.points || 0;
          }
        }
      });

      const allPointsData: PhasePoints[] = Array.from(managerTotals.values())
        .map(mt => {
          const manager = managers?.find(m => m.id === mt.manager_id);
          return {
            phase_id: phase.id,
            phase_index: phase.index_dans_saison,
            manager_id: mt.manager_id,
            manager_nom: manager?.nom || 'Unknown',
            points: mt.points
          };
        });

      const pointsOnly = allPointsData.map(p => p.points);
      const stats = calculateStats(pointsOnly, allPointsData);

      return {
        phase_id: phase.id,
        phase_index: phase.index_dans_saison,
        phase_label: `Phase ${phase.index_dans_saison}`,
        stats,
        all_points: allPointsData.map(p => ({
          manager_id: p.manager_id,
          manager_nom: p.manager_nom,
          points: p.points
        }))
      } as PhaseStats;
    });

    const phaseStats = await Promise.all(phaseStatsPromises);

    // Calculer les stats globales
    const allMins = phaseStats.map(p => p.stats.min);
    const allMaxs = phaseStats.map(p => p.stats.max);

    const result = {
      saison_id: saisonId,
      phases: phaseStats,
      global_stats: {
        overall_min: Math.min(...allMins),
        overall_max: Math.max(...allMaxs),
        phases_count: phases.length
      }
    };

    console.log(`[get-points-distribution] Success: ${phaseStats.length} phases analyzed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-points-distribution] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
