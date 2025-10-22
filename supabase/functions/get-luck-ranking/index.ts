import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { saison_id, league_id } = await req.json();

    console.log('Calculating luck ranking for saison:', saison_id);

    // Fetch managers filtered by league
    let managersQuery = supabase
      .from('managers')
      .select('id, nom, user_id');

    if (league_id) {
      const { data: leagueManagers, error: leagueMembersError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', league_id);

      if (leagueMembersError) throw leagueMembersError;

      const userIds = leagueManagers?.map(lm => lm.user_id) || [];
      managersQuery = managersQuery.in('user_id', userIds);
    }

    const { data: managers, error: managersError } = await managersQuery;
    if (managersError) throw managersError;

    // Get phases for this season
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id')
      .eq('saison_id', saison_id);

    if (phasesError) throw phasesError;

    const phaseIds = phases.map(p => p.id);

    // Get league average for expected performance
    const { data: allPoints } = await supabase
      .from('points_ledger')
      .select('points, manager_id')
      .in('phase_id', phaseIds)
      .eq('league_id', league_id)
      .not('manager_id', 'is', null);

    const totalLeaguePoints = (allPoints || []).reduce((sum, p) => sum + p.points, 0);
    const avgLeaguePoints = managers.length > 0 ? totalLeaguePoints / managers.length : 0;

    // Calculate scores for each manager
    const rankings = await Promise.all(
      managers.map(async (manager) => {
        // Get roster with prices
        const { data: roster } = await supabase
          .from('rosters')
          .select('coureur_id, prix_signature')
          .in('phase_id', phaseIds)
          .eq('manager_id', manager.id)
          .eq('league_id', league_id);

        if (!roster || roster.length === 0) {
          return {
            manager_id: manager.id,
            manager_nom: manager.nom,
            rank: 0,
            luck_score: 50,
            expected_points: 0,
            actual_points: 0,
            performance_gap: 0,
            variance: 0,
            big_wins_ratio: 0,
          };
        }

        // Get points
        const { data: points } = await supabase
          .from('points_ledger')
          .select('points, course_id')
          .in('phase_id', phaseIds)
          .eq('manager_id', manager.id)
          .eq('league_id', league_id);

        const actualPoints = (points || []).reduce((sum, p) => sum + p.points, 0);

        // Calculate expected points based on roster price
        const avgPrice = roster.reduce((sum, r) => sum + (r.prix_signature || 0), 0) / roster.length;
        const expectedPoints = (avgPrice / 20) * avgLeaguePoints * 0.8; // Normalized expectation

        // Performance gap
        const performanceGap = expectedPoints > 0 
          ? ((actualPoints - expectedPoints) / expectedPoints) * 100 
          : 0;

        // Calculate variance (consistency of points across races)
        const pointsByCourse = new Map<string, number>();
        (points || []).forEach(p => {
          pointsByCourse.set(p.course_id, (pointsByCourse.get(p.course_id) || 0) + p.points);
        });

        const coursePoints = Array.from(pointsByCourse.values());
        const avgPointsPerCourse = coursePoints.length > 0 
          ? coursePoints.reduce((sum, p) => sum + p, 0) / coursePoints.length 
          : 0;

        const variance = coursePoints.length > 0
          ? Math.sqrt(
              coursePoints.reduce((sum, p) => sum + Math.pow(p - avgPointsPerCourse, 2), 0) / coursePoints.length
            )
          : 0;

        // Big wins ratio (top 3 positions give more points)
        // Approximate: courses with > avgPointsPerCourse * 1.5 are "big wins"
        const bigWins = coursePoints.filter(p => p > avgPointsPerCourse * 1.5).length;
        const bigWinsRatio = coursePoints.length > 0 ? (bigWins / coursePoints.length) * 100 : 0;

        // Calculate luck score (0-100)
        // 40% performance gap (positive = lucky), 30% variance, 30% big wins
        const gapScore = Math.max(0, Math.min(performanceGap, 100)) * 0.4;
        const varianceScore = Math.min(variance / 10, 30); // Higher variance = more luck
        const bigWinsScore = bigWinsRatio * 0.3;

        const luckScore = Math.round(gapScore + varianceScore + bigWinsScore);

        return {
          manager_id: manager.id,
          manager_nom: manager.nom,
          rank: 0,
          luck_score: luckScore,
          expected_points: Math.round(expectedPoints),
          actual_points: actualPoints,
          performance_gap: Math.round(performanceGap * 10) / 10,
          variance: Math.round(variance * 10) / 10,
          big_wins_ratio: Math.round(bigWinsRatio * 10) / 10,
        };
      })
    );

    // Sort by score and assign ranks
    rankings.sort((a, b) => b.luck_score - a.luck_score);
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    console.log(`Luck ranking calculated for ${rankings.length} managers`);

    return new Response(
      JSON.stringify({ rankings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-luck-ranking:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
