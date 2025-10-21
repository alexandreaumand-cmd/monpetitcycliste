import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // 1. Get phase IDs for the season
    let phaseIds: string[] = [];
    if (saison_id) {
      const { data: phasesData, error: phasesError } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phasesError) throw phasesError;
      phaseIds = phasesData?.map(p => p.id) || [];
      
      if (phaseIds.length === 0) {
        console.log('No phases found for saison_id:', saison_id);
        return new Response(JSON.stringify({ podiums: {}, winners: {} }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Get phases from courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('phase_id')
        .in('id', course_ids);
      
      if (coursesError) throw coursesError;
      phaseIds = [...new Set(coursesData?.map(c => c.phase_id).filter(Boolean) || [])];
    }

    console.log('Processing podiums:', { course_ids_count: course_ids.length, phaseIds_count: phaseIds.length, league_id });

    // 2. Load rosters for the league and phases to build manager mapping
    let managerMap = new Map<string, string>(); // key: `${phase_id}:${coureur_id}` -> manager_id
    
    if (league_id && phaseIds.length > 0) {
      const { data: rostersData, error: rostersError } = await supabase
        .from('rosters')
        .select('manager_id, coureur_id, phase_id')
        .eq('league_id', league_id)
        .in('phase_id', phaseIds);
      
      if (rostersError) throw rostersError;
      
      console.log('Rosters loaded:', rostersData?.length || 0);
      
      rostersData?.forEach(r => {
        const key = `${r.phase_id}:${r.coureur_id}`;
        managerMap.set(key, r.manager_id);
      });
      
      if (managerMap.size === 0) {
        console.log('No rosters found for league_id:', league_id);
        return new Response(JSON.stringify({ podiums: {}, winners: {} }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Load points_ledger for courses and phases
    let pointsQuery = supabase
      .from('points_ledger')
      .select('course_id, coureur_id, phase_id, points')
      .in('course_id', course_ids);
    
    if (phaseIds.length > 0) {
      pointsQuery = pointsQuery.in('phase_id', phaseIds);
    }

    const { data: allPoints, error: pointsError } = await pointsQuery;
    if (pointsError) throw pointsError;

    console.log('Points ledger loaded:', allPoints?.length || 0);

    // 4. Aggregate points by course and manager (in-memory)
    const aggregated: Record<string, Record<string, number>> = {}; // { course_id: { manager_id: total_points } }
    
    allPoints?.forEach(pl => {
      const key = `${pl.phase_id}:${pl.coureur_id}`;
      const managerId = managerMap.get(key);
      
      if (!managerId) {
        // Rider not in this league, skip
        return;
      }
      
      if (!aggregated[pl.course_id]) {
        aggregated[pl.course_id] = {};
      }
      
      aggregated[pl.course_id][managerId] = (aggregated[pl.course_id][managerId] || 0) + (pl.points || 0);
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

    // 7. Calculate winners (existing logic)
    const winnerResult: Record<string, { coureur_id: string; coureur_nom: string; type_classement: string; etape_numero: number | null } | null> = {};

    const { data: coursesInfo, error: coursesInfoError } = await supabase
      .from('courses')
      .select('id, nom, date_debut, date_fin')
      .in('id', course_ids);
    
    if (coursesInfoError) throw coursesInfoError;

    for (const courseInfo of coursesInfo || []) {
      const courseId = courseInfo.id;

      // Priority 1: General classification
      let winnerQuery = supabase
        .from('race_results')
        .select('coureur_id, coureurs!inner(nom), type_classement, etape_numero')
        .eq('course_id', courseId)
        .eq('type_classement', 'General')
        .eq('position', 1)
        .eq('statut', 'finished');

      if (courseInfo.date_debut && courseInfo.date_fin) {
        winnerQuery = winnerQuery
          .gte('date_classement', courseInfo.date_debut)
          .lte('date_classement', courseInfo.date_fin);
      }

      const { data: generalWinner, error: generalError } = await winnerQuery.maybeSingle();
      
      if (generalError && generalError.code !== 'PGRST116') throw generalError;

      if (generalWinner) {
        winnerResult[courseId] = {
          coureur_id: generalWinner.coureur_id,
          coureur_nom: (generalWinner.coureurs as any)?.nom || 'Unknown',
          type_classement: 'General',
          etape_numero: null,
        };
        continue;
      }

      // Priority 2: Highest stage (Etape)
      let stageQuery = supabase
        .from('race_results')
        .select('coureur_id, coureurs!inner(nom), type_classement, etape_numero')
        .eq('course_id', courseId)
        .eq('type_classement', 'Etape')
        .eq('position', 1)
        .eq('statut', 'finished')
        .not('etape_numero', 'is', null);

      if (courseInfo.date_debut && courseInfo.date_fin) {
        stageQuery = stageQuery
          .gte('date_classement', courseInfo.date_debut)
          .lte('date_classement', courseInfo.date_fin);
      }

      const { data: stageWinners, error: stageError } = await stageQuery.order('etape_numero', { ascending: false });
      
      if (stageError) throw stageError;

      if (stageWinners && stageWinners.length > 0) {
        const bestStage = stageWinners[0];
        winnerResult[courseId] = {
          coureur_id: bestStage.coureur_id,
          coureur_nom: (bestStage.coureurs as any)?.nom || 'Unknown',
          type_classement: 'Etape',
          etape_numero: bestStage.etape_numero,
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
