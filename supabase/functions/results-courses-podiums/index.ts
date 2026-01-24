import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { course_ids, saison_id = null, league_id = null } = await req.json();

    if (!course_ids || !Array.isArray(course_ids) || course_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'course_ids array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Load course -> phase_id mapping (critical for correct aggregation)
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, phase_id')
      .in('id', course_ids);
    
    if (coursesError) throw coursesError;
    
    const coursePhaseMap = new Map<string, string>();
    const phaseIds: string[] = [];
    
    coursesData?.forEach(c => {
      if (c.phase_id) {
        coursePhaseMap.set(c.id, c.phase_id);
        if (!phaseIds.includes(c.phase_id)) {
          phaseIds.push(c.phase_id);
        }
      }
    });
    
    // If saison_id provided, also include all phases from that season
    if (saison_id) {
      const { data: phasesData, error: phasesError } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phasesError) throw phasesError;
      
      phasesData?.forEach(p => {
        if (!phaseIds.includes(p.id)) {
          phaseIds.push(p.id);
        }
      });
    }

    console.log('Processing podiums:', { course_ids_count: course_ids.length, phaseIds_count: phaseIds.length, coursePhaseMap_size: coursePhaseMap.size, league_id });

    // 2. Load rosters for the league and phases to build manager mapping
    // Map<coureur+phase, Set<manager_id>> - allows multiple managers per rider
    let managersByCoureur = new Map<string, Set<string>>(); 
    
    if (league_id && phaseIds.length > 0) {
      const rostersData = await fetchAll<{ manager_id: string; coureur_id: string; phase_id: string }>(() =>
        supabase
          .from('rosters')
          .select('manager_id, coureur_id, phase_id')
          .eq('league_id', league_id)
          .in('phase_id', phaseIds)
      );
      
      console.log('Rosters loaded (paged):', rostersData.length);
      
      rostersData?.forEach(r => {
        const key = `${r.phase_id}:${r.coureur_id}`;
        if (!managersByCoureur.has(key)) {
          managersByCoureur.set(key, new Set());
        }
        managersByCoureur.get(key)!.add(r.manager_id);
      });
      
      if (managersByCoureur.size === 0) {
        console.log('No rosters found for league_id:', league_id);
        return new Response(JSON.stringify({ podiums: {}, winners: {} }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Load points_ledger for courses (NO phase_id filter to include all points)
    const allPoints = await fetchAll<{ course_id: string; coureur_id: string; points: number; phase_id: string }>(() =>
      supabase
        .from('points_ledger')
        .select('course_id, coureur_id, points, phase_id')
        .in('course_id', course_ids)
        .in('phase_id', phaseIds)
    );
    
    console.log('Points ledger loaded (paged):', allPoints.length);

    // 4. Aggregate points by course and manager using course's phase_id
    const aggregated: Record<string, Record<string, number>> = {}; // { course_id: { manager_id: total_points } }
    
    allPoints?.forEach(pl => {
      // CRITICAL FIX: Use the course's phase_id, not pl.phase_id (which can be NULL)
      const coursePhaseId = coursePhaseMap.get(pl.course_id);
      
      if (!coursePhaseId) {
        // Course not in our mapping, skip
        return;
      }
      
      const key = `${coursePhaseId}:${pl.coureur_id}`;
      const managerIds = managersByCoureur.get(key);
      
      if (!managerIds || managerIds.size === 0) {
        // Rider not in this league/phase, skip
        return;
      }
      
      if (!aggregated[pl.course_id]) {
        aggregated[pl.course_id] = {};
      }
      
      // Attribute points to all managers who own this rider
      managerIds.forEach(managerId => {
        aggregated[pl.course_id][managerId] = (aggregated[pl.course_id][managerId] || 0) + (pl.points || 0);
      });
    });

    // 5. Get manager names
    const uniqueManagerIds = new Set<string>();
    Object.values(aggregated).forEach(managers => {
      Object.keys(managers).forEach(mid => uniqueManagerIds.add(mid));
    });

    const { data: managersData, error: managersError } = await supabase
      .from('managers')
      .select('id, nom')
      .in('id', Array.from(uniqueManagerIds));

    if (managersError) throw managersError;

    const managersNamesMap = new Map(managersData?.map(m => [m.id, m.nom]) || []);

    console.log('Managers loaded:', managersNamesMap.size);

    // 6. Build podiums (top 3 per course)
    const podiumResult: Record<string, Array<{ manager_id: string; manager_nom: string; points: number; rank: number }>> = {};
    
    Object.entries(aggregated).forEach(([courseId, managers]) => {
      const sorted = Object.entries(managers)
        .map(([managerId, points]) => ({
          manager_id: managerId,
          manager_nom: managersNamesMap.get(managerId) || 'Unknown',
          points,
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
      
      if (sorted.length > 0) {
        podiumResult[courseId] = sorted;
      }
    });

    // 7. Calculate winners using BATCH queries instead of N+1
    const winnerResult: Record<string, { coureur_id: string; coureur_nom: string; type_classement: string; etape_numero: number | null } | null> = {};

    // Batch fetch all general classification winners
    const { data: allGeneralWinners, error: generalError } = await supabase
      .from('race_results')
      .select('course_id, coureur_id, coureurs!inner(nom)')
      .in('course_id', course_ids)
      .eq('type_classement', 'General')
      .eq('position', 1)
      .eq('statut', 'finished');

    if (generalError) throw generalError;

    // Batch fetch all stage winners
    const { data: allStageWinners, error: stageError } = await supabase
      .from('race_results')
      .select('course_id, coureur_id, coureurs!inner(nom), etape_numero')
      .in('course_id', course_ids)
      .eq('type_classement', 'Etape')
      .eq('position', 1)
      .eq('statut', 'finished')
      .not('etape_numero', 'is', null)
      .order('etape_numero', { ascending: false });

    if (stageError) throw stageError;

    // Build maps for O(1) lookup
    const generalWinnersMap = new Map<string, { coureur_id: string; coureur_nom: string }>();
    allGeneralWinners?.forEach(w => {
      if (!generalWinnersMap.has(w.course_id)) {
        generalWinnersMap.set(w.course_id, {
          coureur_id: w.coureur_id,
          coureur_nom: (w.coureurs as any)?.nom || 'Unknown'
        });
      }
    });

    // For stages, keep only the highest stage number per course
    const stageWinnersMap = new Map<string, { coureur_id: string; coureur_nom: string; etape_numero: number }>();
    allStageWinners?.forEach(w => {
      if (!stageWinnersMap.has(w.course_id)) {
        stageWinnersMap.set(w.course_id, {
          coureur_id: w.coureur_id,
          coureur_nom: (w.coureurs as any)?.nom || 'Unknown',
          etape_numero: w.etape_numero!
        });
      }
    });

    // Build winner result for each course
    for (const courseId of course_ids) {
      const generalWinner = generalWinnersMap.get(courseId);
      if (generalWinner) {
        winnerResult[courseId] = {
          coureur_id: generalWinner.coureur_id,
          coureur_nom: generalWinner.coureur_nom,
          type_classement: 'General',
          etape_numero: null,
        };
        continue;
      }

      const stageWinner = stageWinnersMap.get(courseId);
      if (stageWinner) {
        winnerResult[courseId] = {
          coureur_id: stageWinner.coureur_id,
          coureur_nom: stageWinner.coureur_nom,
          type_classement: 'Etape',
          etape_numero: stageWinner.etape_numero,
        };
        continue;
      }

      winnerResult[courseId] = null;
    }

    console.log('Podiums calculated:', Object.keys(podiumResult).length, 'Winners:', Object.keys(winnerResult).length);

    return new Response(JSON.stringify({ podiums: podiumResult, winners: winnerResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-courses-podiums:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
