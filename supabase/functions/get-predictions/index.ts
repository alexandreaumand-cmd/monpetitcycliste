import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

interface Point {
  x: number;
  y: number;
}

interface Regression {
  slope: number;
  intercept: number;
  r_squared: number;
  interpretation: string;
  icon: string;
  color: string;
  confidence: string;
}

interface ManagerPrediction {
  manager_id: string;
  manager_nom: string;
  historical_points: Array<{ phase_index: number; points: number }>;
  regression: Regression;
  predictions: Array<{ phase_index: number; predicted_points: number }>;
  total_predicted: number;
  current_rank: number;
  predicted_rank: number;
}

function linearRegression(points: Point[]): { slope: number; intercept: number; r_squared: number } {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, r_squared: 0 };
  }

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculer R² (coefficient de détermination)
  const meanY = sumY / n;
  const totalSS = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
  const residualSS = points.reduce((s, p) => {
    const predicted = slope * p.x + intercept;
    return s + Math.pow(p.y - predicted, 2);
  }, 0);
  const r_squared = totalSS === 0 ? 0 : Math.max(0, 1 - (residualSS / totalSS));

  return { slope, intercept, r_squared };
}

function interpretTrend(slope: number, r_squared: number): { trend: string; icon: string; color: string; confidence: string } {
  const confidence = r_squared >= 0.7 ? "Haute" : r_squared >= 0.5 ? "Moyenne" : "Faible";
  
  if (Math.abs(slope) < 20) {
    return { trend: "Stable", icon: "➖", color: "yellow", confidence };
  } else if (slope > 0) {
    return { trend: "Forte progression", icon: "📈", color: "green", confidence };
  } else {
    return { trend: "En déclin", icon: "📉", color: "red", confidence };
  }
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

    console.log(`[get-predictions] Fetching predictions for saison: ${saisonId}, league: ${league_id}`);

    // Check if this is the Legacy League
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', league_id)
      .single();

    const isLegacy = leagueData?.name?.toLowerCase().includes('legacy') || false;
    console.log(`[get-predictions] isLegacy: ${isLegacy}`);

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
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id, index_dans_saison, statut')
      .eq('saison_id', saisonId)
      .order('index_dans_saison');

    if (phasesError) throw phasesError;
    if (!phases || phases.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No phases found for this season' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const completedPhases = phases.filter(p => p.statut === 'completed');
    const totalPhases = phases.length;

    console.log(`[get-predictions] ${completedPhases.length} completed phases out of ${totalPhases}`);

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

    console.log(`[get-predictions] Found ${managers?.length || 0} managers`);

    // Calculer les points par phase pour chaque manager (utiliser le même calcul que get-points-distribution)
    const managerPhasePoints = new Map<string, Array<{ phase_index: number; points: number }>>();

    for (const phase of completedPhases) {
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

      const phaseTotals = new Map<string, number>();

      // Initialiser avec 0
      managers?.forEach(m => phaseTotals.set(m.id, 0));

      // Map race points to managers via rosters
      rosters?.forEach(roster => {
        const riderPoints = racePointsData.filter(rp => rp.coureur_id === roster.coureur_id);
        const totalRiderPoints = riderPoints.reduce((sum, rp) => sum + (rp.points || 0), 0);
        phaseTotals.set(roster.manager_id, (phaseTotals.get(roster.manager_id) || 0) + totalRiderPoints);
      });

      managerBonus?.forEach(mb => {
        const current = phaseTotals.get(mb.manager_id) || 0;
        phaseTotals.set(mb.manager_id, current + (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
                       (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + (mb.bonus_scoreurs || 0));
      });

      riderBonus?.forEach(rb => {
        const targetId = rb.target_manager_id || rb.manager_id;
        if (targetId) {
          phaseTotals.set(targetId, (phaseTotals.get(targetId) || 0) + (rb.points || 0));
        }
      });

      // Stocker les points par manager
      phaseTotals.forEach((points, managerId) => {
        if (!managerPhasePoints.has(managerId)) {
          managerPhasePoints.set(managerId, []);
        }
        managerPhasePoints.get(managerId)!.push({
          phase_index: phase.index_dans_saison,
          points
        });
      });
    }

    // Calculer les prédictions pour chaque manager
    const predictions: ManagerPrediction[] = [];

    for (const manager of managers || []) {
      const historicalPoints = managerPhasePoints.get(manager.id) || [];
      
      if (historicalPoints.length < 2) {
        continue; // Pas assez de données pour une régression
      }

      // Préparer les données pour la régression
      const regressionPoints: Point[] = historicalPoints.map(hp => ({
        x: hp.phase_index,
        y: hp.points
      }));

      const regression = linearRegression(regressionPoints);
      const interpretation = interpretTrend(regression.slope, regression.r_squared);

      // Générer les prédictions pour les phases futures
      const futurePredictions: Array<{ phase_index: number; predicted_points: number }> = [];
      const lastCompletedIndex = completedPhases[completedPhases.length - 1].index_dans_saison;

      for (let i = lastCompletedIndex + 1; i <= totalPhases; i++) {
        const predictedPoints = Math.round(regression.slope * i + regression.intercept);
        futurePredictions.push({
          phase_index: i,
          predicted_points: Math.max(0, predictedPoints) // Pas de points négatifs
        });
      }

      // Calculer le total prédit (historique + futur)
      const historicalTotal = historicalPoints.reduce((sum, hp) => sum + hp.points, 0);
      const futureTotal = futurePredictions.reduce((sum, fp) => sum + fp.predicted_points, 0);
      const totalPredicted = historicalTotal + futureTotal;

      predictions.push({
        manager_id: manager.id,
        manager_nom: manager.nom,
        historical_points: historicalPoints,
        regression: {
          slope: Math.round(regression.slope * 10) / 10,
          intercept: Math.round(regression.intercept),
          r_squared: Math.round(regression.r_squared * 100) / 100,
          interpretation: interpretation.trend,
          icon: interpretation.icon,
          color: interpretation.color,
          confidence: interpretation.confidence
        },
        predictions: futurePredictions,
        total_predicted: totalPredicted,
        current_rank: 0, // Will be calculated below
        predicted_rank: 0 // Will be calculated below
      });
    }

    // Calculer les rangs actuels
    const currentTotals = predictions.map(p => ({
      manager_id: p.manager_id,
      total: p.historical_points.reduce((sum, hp) => sum + hp.points, 0)
    })).sort((a, b) => b.total - a.total);

    currentTotals.forEach((ct, index) => {
      const pred = predictions.find(p => p.manager_id === ct.manager_id);
      if (pred) pred.current_rank = index + 1;
    });

    // Calculer les rangs prédits
    const predictedTotals = predictions.map(p => ({
      manager_id: p.manager_id,
      total: p.total_predicted
    })).sort((a, b) => b.total - a.total);

    predictedTotals.forEach((pt, index) => {
      const pred = predictions.find(p => p.manager_id === pt.manager_id);
      if (pred) pred.predicted_rank = index + 1;
    });

    // Trier par rang prédit
    predictions.sort((a, b) => a.predicted_rank - b.predicted_rank);

    const result = {
      saison_id: saisonId,
      predictions,
      meta: {
        completed_phases: completedPhases.length,
        remaining_phases: totalPhases - completedPhases.length,
        total_phases: totalPhases
      }
    };

    console.log(`[get-predictions] Success: ${predictions.length} managers analyzed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-predictions] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
