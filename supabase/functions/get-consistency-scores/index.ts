import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-consistency-scores function loaded');

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

    const { saison_id, league_id } = await req.json();

    if (!saison_id || !league_id) {
      return new Response(
        JSON.stringify({ error: 'saison_id and league_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-consistency-scores] Fetching consistency for saison: ${saison_id}, league: ${league_id}`);

    // Check if this is the Legacy League
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', league_id)
      .single();

    const isLegacy = leagueData?.name?.toLowerCase().includes('legacy') || false;
    console.log(`[get-consistency-scores] isLegacy: ${isLegacy}`);

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

    // Get all phases for the season
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id, index_dans_saison')
      .eq('saison_id', saison_id)
      .order('index_dans_saison', { ascending: true });

    if (phasesError) throw phasesError;

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

    console.log(`[get-consistency-scores] Found ${managers?.length || 0} managers`);

    // STEP 1: Calculate all phase standings once (cache optimization)
    const phaseStandingsCache = new Map<string, Array<{ manager_id: string; total_points: number }>>();

    for (const phase of phases) {
      const allManagersPoints: Array<{ manager_id: string; total_points: number }> = [];

      for (const mgr of managers) {
        // Get manager's roster for this phase
        const { data: roster } = await supabase
          .from('rosters')
          .select('coureur_id')
          .eq('phase_id', phase.id)
          .eq('manager_id', mgr.id)
          .eq('league_id', league_id);

        const coureurIds = roster?.map(r => r.coureur_id) || [];

        // Get race points for manager's riders
        let raceTotalMgr = 0;
        if (coureurIds.length > 0) {
          const { data: racePts } = await supabase
            .from('points_ledger')
            .select('points')
            .eq('phase_id', phase.id)
            .in('coureur_id', coureurIds);

          raceTotalMgr = racePts?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
        }

        // Get manager bonus
        const { data: mgrBonus } = await supabase
          .from('manager_bonus_points')
          .select('bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs')
          .eq('phase_id', phase.id)
          .eq('manager_id', mgr.id)
          .eq('league_id', league_id)
          .maybeSingle();

        const bonusTotalMgr = mgrBonus
          ? (mgrBonus.bonus_itt || 0) +
            (mgrBonus.bonus_ttt || 0) +
            (mgrBonus.bonus_first_win || 0) +
            (mgrBonus.bonus_coureurs || 0) +
            (mgrBonus.bonus_scoreurs || 0)
          : 0;

        // Get rider bonus
        const { data: riderBonusMgr } = await supabase
          .from('bonus_points')
          .select('points')
          .eq('phase_id', phase.id)
          .eq('league_id', league_id)
          .or(`manager_id.eq.${mgr.id},target_manager_id.eq.${mgr.id}`);

        const riderBonusTotalMgr = riderBonusMgr?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;

        const totalMgr = raceTotalMgr + bonusTotalMgr + riderBonusTotalMgr;

        allManagersPoints.push({
          manager_id: mgr.id,
          total_points: totalMgr
        });
      }

      // Sort and cache
      phaseStandingsCache.set(
        phase.id,
        allManagersPoints.sort((a, b) => b.total_points - a.total_points)
      );
    }

    // STEP 1.5: Calculate total points distributed per phase
    const phaseTotalsMap = new Map<string, number>();

    for (const phase of phases) {
      const sortedManagers = phaseStandingsCache.get(phase.id)!;
      const totalPhasePoints = sortedManagers.reduce((sum, m) => sum + m.total_points, 0);
      phaseTotalsMap.set(phase.id, totalPhasePoints);
    }

    // STEP 2: Build consistency scores using cached standings
    const scores = [];

    for (const manager of managers) {
      const pointsByPhase = [];
      const ranksByPhase = [];

      for (const phase of phases) {
        // Get standings from cache
        const sortedManagers = phaseStandingsCache.get(phase.id)!;
        const rank = sortedManagers.findIndex((m) => m.manager_id === manager.id) + 1;
        
        // Get points from cache
        const phasePoints = sortedManagers.find(m => m.manager_id === manager.id)?.total_points || 0;
        
        // Calculate percentage relative to phase total
        const totalPhasePoints = phaseTotalsMap.get(phase.id) || 1;
        const percentageOfPhase = totalPhasePoints > 0 
          ? (phasePoints / totalPhasePoints) * 100 
          : 0;

        pointsByPhase.push({
          phase_id: phase.id,
          phase_index: phase.index_dans_saison,
          points: phasePoints,
          percentage: Math.round(percentageOfPhase * 100) / 100,
          rank
        });

        ranksByPhase.push(percentageOfPhase);
      }

      if (ranksByPhase.length === 0) continue;

      // Calculate statistics
      const mean = ranksByPhase.reduce((sum, p) => sum + p, 0) / ranksByPhase.length;
      const variance = ranksByPhase.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / ranksByPhase.length;
      const stdDev = Math.sqrt(variance);
      const coefficientVariation = mean > 0 ? (stdDev / mean) * 100 : 0;
      
      // Consistency score: 100 - CV
      const consistencyScore = Math.max(0, Math.min(100, 100 - coefficientVariation));

      const min = Math.round(Math.min(...ranksByPhase) * 100) / 100;
      const max = Math.round(Math.max(...ranksByPhase) * 100) / 100;

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
          mean: Math.round(mean * 100) / 100,
          std_dev: Math.round(stdDev * 10) / 10,
          coefficient_variation: Math.round(coefficientVariation * 10) / 10,
          min,
          max,
          range: Math.round((max - min) * 100) / 100,
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
