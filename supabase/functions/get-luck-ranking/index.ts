import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PAGE_SIZE = 1000;

async function fetchAllRows(queryFn: (offset: number) => Promise<{ data: any[] | null; error: any }>) {
  let all: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await queryFn(offset);
    if (error) throw error;
    if (data && data.length > 0) {
      all = all.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { saison_id, league_id } = await req.json();
    console.log('Calculating luck ranking for saison:', saison_id, 'league:', league_id);

    // Fetch managers filtered by league
    let managersQuery = supabase.from('managers').select('id, nom, user_id');
    if (league_id) {
      const { data: leagueManagers, error: leagueMembersError } = await supabase
        .from('league_members').select('user_id').eq('league_id', league_id);
      if (leagueMembersError) throw leagueMembersError;
      const userIds = leagueManagers?.map(lm => lm.user_id) || [];
      managersQuery = managersQuery.in('user_id', userIds);
    }
    const { data: managers, error: managersError } = await managersQuery;
    if (managersError) throw managersError;

    // Get phases for this season
    const { data: phases, error: phasesError } = await supabase
      .from('phases').select('id').eq('saison_id', saison_id);
    if (phasesError) throw phasesError;
    const phaseIds = phases.map(p => p.id);

    // Fetch all courses for name lookup
    const { data: coursesData } = await supabase.from('courses').select('id, nom');
    const courseNameMap = new Map<string, string>();
    (coursesData || []).forEach(c => courseNameMap.set(c.id, c.nom));

    // Calculate actual points for each manager (paginated)
    const managerActuals: { manager_id: string; manager_nom: string; actual_points: number; pointsByCourse: Map<string, number> }[] = [];

    for (const manager of managers) {
      // Get roster for this manager in this league
      const { data: roster } = await supabase
        .from('rosters')
        .select('coureur_id')
        .in('phase_id', phaseIds)
        .eq('manager_id', manager.id)
        .eq('league_id', league_id);

      if (!roster || roster.length === 0) {
        managerActuals.push({ manager_id: manager.id, manager_nom: manager.nom, actual_points: 0, pointsByCourse: new Map() });
        continue;
      }

      const coureurIds = [...new Set(roster.map(r => r.coureur_id))];

      // Fetch all points for these riders in these phases (paginated)
      const points = await fetchAllRows((offset) =>
        supabase
          .from('points_ledger')
          .select('points, course_id')
          .in('phase_id', phaseIds)
          .in('coureur_id', coureurIds)
          .range(offset, offset + PAGE_SIZE - 1)
      );

      const actualPoints = points.reduce((sum, p) => sum + p.points, 0);
      const pointsByCourse = new Map<string, number>();
      points.forEach(p => {
        pointsByCourse.set(p.course_id, (pointsByCourse.get(p.course_id) || 0) + p.points);
      });

      managerActuals.push({ manager_id: manager.id, manager_nom: manager.nom, actual_points: actualPoints, pointsByCourse });
    }

    // Compute expected_points = league average
    const totalLeaguePoints = managerActuals.reduce((sum, m) => sum + m.actual_points, 0);
    const expectedPoints = managerActuals.length > 0 ? Math.round(totalLeaguePoints / managerActuals.length) : 0;

    // Build rankings
    const rankings = managerActuals.map((m) => {
      const coursePoints = Array.from(m.pointsByCourse.entries());
      const coursePointValues = coursePoints.map(([, pts]) => pts);
      const avgPointsPerCourse = coursePointValues.length > 0
        ? coursePointValues.reduce((sum, p) => sum + p, 0) / coursePointValues.length
        : 0;

      const variance = coursePointValues.length > 0
        ? Math.sqrt(coursePointValues.reduce((sum, p) => sum + Math.pow(p - avgPointsPerCourse, 2), 0) / coursePointValues.length)
        : 0;

      const bigWinThreshold = avgPointsPerCourse * 1.5;
      const bigWinsDetails = coursePoints
        .filter(([, pts]) => pts > bigWinThreshold)
        .map(([courseId, pts]) => ({ course_id: courseId, course_nom: courseNameMap.get(courseId) || 'Course inconnue', points: Math.round(pts) }))
        .sort((a, b) => b.points - a.points);

      const bigWinsRatio = coursePointValues.length > 0 ? (bigWinsDetails.length / coursePointValues.length) * 100 : 0;

      const courseBreakdown = coursePoints
        .map(([courseId, pts]) => ({ course_id: courseId, course_nom: courseNameMap.get(courseId) || 'Course inconnue', points: Math.round(pts), is_big_win: pts > bigWinThreshold }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

      const performanceGap = expectedPoints > 0
        ? ((m.actual_points - expectedPoints) / expectedPoints) * 100
        : 0;

      // Luck score
      const gapScore = Math.max(0, Math.min(performanceGap, 100)) * 0.4;
      const varianceScore = Math.min(variance / 10, 30);
      const bigWinsScore = bigWinsRatio * 0.3;
      const luckScore = Math.round(gapScore + varianceScore + bigWinsScore);

      return {
        manager_id: m.manager_id,
        manager_nom: m.manager_nom,
        rank: 0,
        luck_score: luckScore,
        expected_points: expectedPoints,
        actual_points: Math.round(m.actual_points),
        performance_gap: Math.round(performanceGap * 10) / 10,
        variance: Math.round(variance * 10) / 10,
        big_wins_ratio: Math.round(bigWinsRatio * 10) / 10,
        big_wins_details: bigWinsDetails,
        course_breakdown: courseBreakdown,
      };
    });

    rankings.sort((a, b) => b.luck_score - a.luck_score);
    rankings.forEach((r, idx) => { r.rank = idx + 1; });

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
