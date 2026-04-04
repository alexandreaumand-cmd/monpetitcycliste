import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  course_ids: string[];
  league_id: string | null;
}

interface ManagerPodium {
  manager_id: string;
  manager_nom: string;
  points: number;
  rank: number;
}

const PAGE_SIZE = 1000;
async function fetchAll<T>(makeQuery: () => any): Promise<T[]> {
  let from = 0;
  const all: T[] = [];
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await makeQuery().range(from, to);
    if (error) throw error;
    const batch = (data as T[]) || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { course_ids, league_id }: RequestBody = await req.json();
    
    console.log(`[courses-leaderboard-podiums] Processing ${course_ids.length} courses for league ${league_id || 'Legacy'}`);

    if (!course_ids || course_ids.length === 0) {
      return new Response(
        JSON.stringify({ podiums: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get course phase mapping
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, phase_id')
      .in('id', course_ids);

    if (coursesError) {
      console.error('[courses-leaderboard-podiums] Error fetching courses:', coursesError);
      throw coursesError;
    }

    const coursePhaseMap = new Map<string, string>();
    const phaseIds = new Set<string>();
    
    for (const course of coursesData || []) {
      coursePhaseMap.set(course.id, course.phase_id);
      phaseIds.add(course.phase_id);
    }

    console.log(`[courses-leaderboard-podiums] Found ${phaseIds.size} unique phases`);

    if (phaseIds.size === 0) {
      return new Response(
        JSON.stringify({ podiums: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Load rosters for these phases and league (paged)
    const rostersData = await fetchAll<{ coureur_id: string; manager_id: string; phase_id: string }>(() => {
      let q = supabase
        .from('rosters')
        .select('coureur_id, manager_id, phase_id')
        .in('phase_id', Array.from(phaseIds));
      return league_id ? q.eq('league_id', league_id) : q;
    });

    // Build map: phase_id:coureur_id -> manager_id
    const rosterMap = new Map<string, string>();
    for (const roster of rostersData || []) {
      const key = `${roster.phase_id}:${roster.coureur_id}`;
      rosterMap.set(key, roster.manager_id);
    }

    console.log(`[courses-leaderboard-podiums] Loaded ${rosterMap.size} roster entries`);

    // 3. Load points_ledger for these courses and phases
    const pointsData = await fetchAll<{ course_id: string; coureur_id: string; points: number; phase_id: string }>(() =>
      supabase
        .from('points_ledger')
        .select('course_id, coureur_id, points, phase_id')
        .in('course_id', course_ids)
        .in('phase_id', Array.from(phaseIds))
    );

    console.log(`[courses-leaderboard-podiums] Loaded ${pointsData.length} points entries (paged)`);

    // 4. Aggregate points by course_id and manager_id
    const courseManagerPoints = new Map<string, Map<string, number>>();

    for (const point of pointsData || []) {
      const coursePhaseId = coursePhaseMap.get(point.course_id);
      if (!coursePhaseId) continue;

      const rosterKey = `${coursePhaseId}:${point.coureur_id}`;
      const managerId = rosterMap.get(rosterKey);
      
      if (!managerId) continue;

      if (!courseManagerPoints.has(point.course_id)) {
        courseManagerPoints.set(point.course_id, new Map());
      }

      const managerMap = courseManagerPoints.get(point.course_id)!;
      const current = managerMap.get(managerId) || 0;
      managerMap.set(managerId, current + (point.points || 0));
    }

    // 5. Get all unique manager IDs and fetch their names
    const allManagerIds = new Set<string>();
    for (const managerMap of courseManagerPoints.values()) {
      for (const managerId of managerMap.keys()) {
        allManagerIds.add(managerId);
      }
    }

    const { data: managersData, error: managersError } = await supabase
      .from('managers')
      .select('id, nom')
      .in('id', Array.from(allManagerIds));

    if (managersError) {
      console.error('[courses-leaderboard-podiums] Error fetching managers:', managersError);
      throw managersError;
    }

    const managerNames = new Map<string, string>();
    for (const manager of managersData || []) {
      managerNames.set(manager.id, manager.nom);
    }

    // 6. Build podiums (top 3) for each course
    const podiums: Record<string, ManagerPodium[]> = {};

    for (const [courseId, managerMap] of courseManagerPoints.entries()) {
      const leaderboard = Array.from(managerMap.entries())
        .map(([managerId, points]) => ({
          manager_id: managerId,
          manager_nom: managerNames.get(managerId) || 'Unknown',
          points,
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

      podiums[courseId] = leaderboard;
    }

    console.log(`[courses-leaderboard-podiums] Generated podiums for ${Object.keys(podiums).length} courses`);

    return new Response(
      JSON.stringify({ podiums }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[courses-leaderboard-podiums] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
