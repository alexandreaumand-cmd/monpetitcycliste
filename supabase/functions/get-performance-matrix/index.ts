import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-performance-matrix function loaded');

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

    console.log('Fetching performance matrix for saison:', saison_id);

    // Get all phases for the season
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id, index_dans_saison, date_debut, date_fin, statut')
      .eq('saison_id', saison_id)
      .order('index_dans_saison', { ascending: true });

    if (phasesError) throw phasesError;

    // Get all managers
    const { data: managers, error: managersError } = await supabase
      .from('managers')
      .select('id, nom')
      .order('nom');

    if (managersError) throw managersError;

    // Calculate points by manager and phase
    const matrix = [];
    
    for (const manager of managers) {
      const managerData: any = {
        manager_id: manager.id,
        manager_nom: manager.nom,
        phases: [],
        total_points: 0,
        average_rank: 0,
        best_phase: null,
        worst_phase: null
      };

      let totalRank = 0;
      let phaseCount = 0;
      let bestRank = Infinity;
      let worstRank = 0;

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
        managerData.total_points += phasePoints;

        // Calculate rank for this phase
        const { data: allManagersPoints } = await supabase.rpc('calculate_phase_standings', {
          p_phase_id: phase.id
        });

        const sortedManagers = (allManagersPoints || []).sort((a: any, b: any) => b.total_points - a.total_points);
        const rank = sortedManagers.findIndex((m: any) => m.manager_id === manager.id) + 1;
        const totalManagers = sortedManagers.length;
        const percentile = totalManagers > 0 ? ((totalManagers - rank + 1) / totalManagers) * 100 : 0;

        managerData.phases.push({
          phase_id: phase.id,
          phase_index: phase.index_dans_saison,
          points: phasePoints,
          rank,
          total_managers: totalManagers,
          percentile
        });

        totalRank += rank;
        phaseCount++;

        if (rank < bestRank) {
          bestRank = rank;
          managerData.best_phase = { phase_id: phase.id, rank };
        }
        if (rank > worstRank) {
          worstRank = rank;
          managerData.worst_phase = { phase_id: phase.id, rank };
        }
      }

      managerData.average_rank = phaseCount > 0 ? totalRank / phaseCount : 0;
      matrix.push(managerData);
    }

    // Sort by total points
    matrix.sort((a, b) => b.total_points - a.total_points);

    const result = {
      saison_id,
      phases: phases.map(p => ({
        id: p.id,
        index: p.index_dans_saison,
        label: `Phase ${p.index_dans_saison}`,
        date_debut: p.date_debut,
        date_fin: p.date_fin,
        statut: p.statut
      })),
      managers: managers.map(m => ({ id: m.id, nom: m.nom })),
      matrix
    };

    console.log(`Performance matrix calculated: ${managers.length} managers, ${phases.length} phases`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-performance-matrix:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
