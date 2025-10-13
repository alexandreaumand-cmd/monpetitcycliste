import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-consistency-scores function loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { saison_id } = await req.json();

    console.log('Calculating consistency scores for saison:', saison_id);

    // Get all phases for the season
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id, index_dans_saison')
      .eq('saison_id', saison_id)
      .order('index_dans_saison', { ascending: true });

    if (phasesError) throw phasesError;

    // Get all managers
    const { data: managers, error: managersError } = await supabase
      .from('managers')
      .select('id, nom')
      .order('nom');

    if (managersError) throw managersError;

    const scores = [];

    for (const manager of managers) {
      const pointsByPhase = [];
      const ranksByPhase = [];

      for (const phase of phases) {
        // Get race points
        const { data: racePoints } = await supabase
          .from('points_ledger')
          .select('points')
          .eq('phase_id', phase.id)
          .eq('manager_id', manager.id);

        const raceTotal = racePoints?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;

        // Get manager bonus
        const { data: managerBonus } = await supabase
          .from('manager_bonus_points')
          .select('bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs')
          .eq('phase_id', phase.id)
          .eq('manager_id', manager.id)
          .single();

        const bonusTotal = managerBonus 
          ? (managerBonus.bonus_itt || 0) + 
            (managerBonus.bonus_ttt || 0) + 
            (managerBonus.bonus_first_win || 0) + 
            (managerBonus.bonus_coureurs || 0) + 
            (managerBonus.bonus_scoreurs || 0)
          : 0;

        // Get rider bonus
        const { data: riderBonus } = await supabase
          .from('bonus_points')
          .select('points')
          .eq('phase_id', phase.id)
          .or(`manager_id.eq.${manager.id},target_manager_id.eq.${manager.id}`);

        const riderBonusTotal = riderBonus?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

        const phasePoints = raceTotal + bonusTotal + riderBonusTotal;

        // Calculate rank
        const { data: allManagersPoints } = await supabase.rpc('calculate_phase_standings', {
          p_phase_id: phase.id
        });

        const sortedManagers = (allManagersPoints || []).sort((a: any, b: any) => b.total_points - a.total_points);
        const rank = sortedManagers.findIndex((m: any) => m.manager_id === manager.id) + 1;

        pointsByPhase.push({
          phase_id: phase.id,
          phase_index: phase.index_dans_saison,
          points: phasePoints,
          rank
        });

        ranksByPhase.push(phasePoints);
      }

      if (ranksByPhase.length === 0) continue;

      // Calculate statistics
      const mean = ranksByPhase.reduce((sum, p) => sum + p, 0) / ranksByPhase.length;
      const variance = ranksByPhase.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / ranksByPhase.length;
      const stdDev = Math.sqrt(variance);
      const coefficientVariation = mean > 0 ? (stdDev / mean) * 100 : 0;
      
      // Consistency score: 100 - CV
      const consistencyScore = Math.max(0, Math.min(100, 100 - coefficientVariation));

      const min = Math.min(...ranksByPhase);
      const max = Math.max(...ranksByPhase);

      const getInterpretation = (score: number) => {
        if (score >= 95) return 'Excellent';
        if (score >= 85) return 'Bon';
        if (score >= 70) return 'Moyen';
        if (score >= 50) return 'Variable';
        return 'Très variable';
      };

      scores.push({
        manager_id: manager.id,
        manager_nom: manager.nom,
        consistency_score: Math.round(consistencyScore * 10) / 10,
        interpretation: getInterpretation(consistencyScore),
        stats: {
          mean: Math.round(mean),
          std_dev: Math.round(stdDev * 10) / 10,
          coefficient_variation: Math.round(coefficientVariation * 10) / 10,
          min,
          max,
          range: max - min,
          phases_count: ranksByPhase.length
        },
        points_by_phase: pointsByPhase
      });
    }

    // Sort by consistency score
    scores.sort((a, b) => b.consistency_score - a.consistency_score);

    const result = {
      saison_id,
      scope: 'saison',
      scores
    };

    console.log(`Consistency scores calculated for ${managers.length} managers`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-consistency-scores:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
