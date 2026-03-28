import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-performance-matrix function loaded');

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

    console.log('Fetching performance matrix for saison:', saison_id, 'league:', league_id);

    // Check if this is the Legacy League
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', league_id)
      .single();

    const isLegacy = leagueData?.name?.toLowerCase().includes('legacy') || false;
    console.log(`[get-performance-matrix] isLegacy: ${isLegacy}`);

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
    const { data: allPhases, error: phasesError } = await supabase
      .from('phases')
      .select('id, index_dans_saison, date_debut, date_fin, statut')
      .eq('saison_id', saison_id)
      .order('index_dans_saison', { ascending: true });

    if (phasesError) throw phasesError;

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

    // Fetch managers via league_members (works for both Legacy and private leagues)
    let managers: Array<{ id: string; nom: string; user_id: string }> | null;
    
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

    console.log(`[get-performance-matrix] Found ${managers?.length || 0} managers`);

    // STEP 1: Calculate all phase standings once (cache optimization)
    const phaseStandingsCache = new Map<string, Array<{ manager_id: string; total_points: number }>>();

    for (const phase of phases) {
      const allManagersPoints: Array<{ manager_id: string; total_points: number }> = [];

      for (const mgr of managers) {
        // Use the view that correctly handles race points + all bonuses
        const { data: standings } = await supabase
          .from('v_manager_standings_by_phase_v2')
          .select('total_points')
          .eq('phase_id', phase.id)
          .eq('manager_id', mgr.id)
          .eq('league_id', league_id)
          .maybeSingle();

        const totalMgr = standings?.total_points || 0;

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

    // STEP 2: Build matrix using cached standings
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
        // Get standings from cache
        const sortedManagers = phaseStandingsCache.get(phase.id)!;
        const rank = sortedManagers.findIndex((m) => m.manager_id === manager.id) + 1;
        const totalManagers = sortedManagers.length;
        const percentile = totalManagers > 0 ? ((totalManagers - rank + 1) / totalManagers) * 100 : 0;

        // Get points from cache
        const managerPoints = sortedManagers.find(m => m.manager_id === manager.id)?.total_points || 0;

        managerData.total_points += managerPoints;

        managerData.phases.push({
          phase_id: phase.id,
          phase_index: phase.index_dans_saison,
          points: managerPoints,
          rank,
          total_managers: totalManagers,
          percentile
        });

        totalRank += rank;
        phaseCount++;

        if (rank > 0 && rank < bestRank) {
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
