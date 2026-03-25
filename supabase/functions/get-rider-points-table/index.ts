import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-rider-points-table function loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
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

    const { rider_id, saison_id, phase_id, league_id } = await req.json();

    if (!rider_id) {
      throw new Error('rider_id is required');
    }

    console.log('Fetching rider points table:', { rider_id, saison_id, phase_id, league_id });

    // Get rider info
    const { data: riderData, error: riderError } = await supabase
      .from('coureurs')
      .select('id, nom')
      .eq('id', rider_id)
      .single();

    if (riderError) {
      console.error('Error fetching rider:', riderError);
      throw riderError;
    }

    // Determine saison_id from filters
    let targetSaisonId = saison_id;
    if (!targetSaisonId && phase_id) {
      const { data: phaseData } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', phase_id)
        .single();
      targetSaisonId = phaseData?.saison_id;
    }

    // Get team for the season from equipes_saisons (corrected lookup)
    let equipe = 'N/A';
    if (targetSaisonId) {
      const { data: csData } = await supabase
        .from('coureurs_saisons')
        .select('equipe_id')
        .eq('coureur_id', rider_id)
        .eq('saison_id', targetSaisonId)
        .maybeSingle();
      
      if (csData?.equipe_id) {
        const { data: esData } = await supabase
          .from('equipes_saisons')
          .select('nom_affiche')
          .eq('equipe_id', csData.equipe_id)
          .eq('saison_id', targetSaisonId)
          .maybeSingle();
        equipe = esData?.nom_affiche || 'N/A';
      }
    }

    // --- League scope filtering ---
    let leagueCourseIds: string[] | null = null;
    let leagueDateFloor: string | null = null;

    if (league_id) {
      // Get allowed course IDs
      const { data: scopeData } = await supabase.rpc('get_league_course_ids', { p_league_id: league_id });
      if (scopeData && scopeData.length > 0) {
        leagueCourseIds = scopeData.map((r: any) => r.course_id);
      }

      // Get league date floor
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('started_at_effective, created_at')
        .eq('id', league_id)
        .single();
      
      if (leagueData) {
        const effectiveDate = leagueData.started_at_effective || leagueData.created_at;
        if (effectiveDate) {
          leagueDateFloor = effectiveDate.substring(0, 10); // YYYY-MM-DD
        }
      }
    }

    // Build query for points
    let query = supabase
      .from('points_ledger')
      .select('points, phase_id, course_id, type_classement, etape_numero')
      .eq('coureur_id', rider_id);

    // Apply phase/season filters
    if (phase_id) {
      query = query.eq('phase_id', phase_id);
    } else if (saison_id) {
      const { data: phases } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        query = query.in('phase_id', phaseIds);
      }
    }

    // Apply league course filter
    if (leagueCourseIds) {
      query = query.in('course_id', leagueCourseIds);
    }

    const { data: pointsData, error: pointsError } = await query.limit(500);

    if (pointsError) {
      console.error('Error fetching points:', pointsError);
      throw pointsError;
    }

    // Filter by league date floor if applicable
    let filteredPointsData = pointsData || [];

    // Fetch courses separately (including phase_id)
    const courseIds = [...new Set(filteredPointsData.map(p => p.course_id).filter(Boolean))];
    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, nom, categorie, date_debut, date_fin, phase_id')
      .in('id', courseIds.length > 0 ? courseIds : ['__none__']);
    
    const coursesMap = new Map(coursesData?.map(c => [c.id, c]) || []);

    // Apply date floor filter after fetching courses
    if (leagueDateFloor) {
      const validCourseIds = new Set(
        (coursesData || [])
          .filter(c => c.date_debut && c.date_debut >= leagueDateFloor!)
          .map(c => c.id)
      );
      filteredPointsData = filteredPointsData.filter(p => p.course_id && validCourseIds.has(p.course_id));
    }

    console.log(`Successfully fetched ${filteredPointsData.length} point entries for rider ${rider_id}`);

    // Fetch race_result_sets to determine TTT status
    const finalCourseIds = [...new Set(filteredPointsData.map(p => p.course_id).filter(Boolean))];
    const { data: resultSetsData } = await supabase
      .from('race_result_sets')
      .select('course_id, type_classement, etape_numero, is_ttt')
      .in('course_id', finalCourseIds.length > 0 ? finalCourseIds : ['__none__'])
      .eq('is_ttt', true);
    
    // Build TTT lookup map
    const tttMap = new Map<string, boolean>();
    resultSetsData?.forEach((rrs: any) => {
      const key = `${rrs.course_id}_${rrs.type_classement}_${rrs.etape_numero || 'null'}`;
      tttMap.set(key, true);
    });

    // Fetch phases separately
    const phaseIdsFromPoints = [...new Set(filteredPointsData.map(p => p.phase_id).filter(Boolean))];
    const phaseIdsFromCourses = [...new Set(coursesData?.map(c => c.phase_id).filter(Boolean) || [])];
    const allPhaseIds = [...new Set([...phaseIdsFromPoints, ...phaseIdsFromCourses])];
    
    const { data: phasesData } = await supabase
      .from('phases')
      .select('id, index_dans_saison, saison_id')
      .in('id', allPhaseIds.length > 0 ? allPhaseIds : ['__none__']);
    
    const phasesMap = new Map(phasesData?.map(p => [p.id, p]) || []);

    // Get race_results to find positions
    const { data: resultsData, error: resultsError } = await supabase
      .from('race_results')
      .select('course_id, type_classement, etape_numero, position')
      .eq('coureur_id', rider_id)
      .in('course_id', finalCourseIds.length > 0 ? finalCourseIds : ['__none__']);

    if (resultsError) {
      console.error('Error fetching results:', resultsError);
    }

    // Build results map for quick lookup
    const resultsMap = new Map();
    resultsData?.forEach((result: any) => {
      const key = `${result.course_id}_${result.type_classement}_${result.etape_numero || 'null'}`;
      resultsMap.set(key, result.position);
    });

    // Get bonus points
    let bonusQuery = supabase
      .from('bonus_points')
      .select('points, bonus_type, commentaire, created_at, phase_id, course_id')
      .eq('coureur_id', rider_id);

    if (phase_id) {
      bonusQuery = bonusQuery.eq('phase_id', phase_id);
    } else if (saison_id) {
      const { data: phases } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        bonusQuery = bonusQuery.in('phase_id', phaseIds);
      }
    }

    // Apply league course filter to bonuses
    if (leagueCourseIds) {
      bonusQuery = bonusQuery.in('course_id', leagueCourseIds);
    }

    const { data: bonusData, error: bonusError } = await bonusQuery;

    if (bonusError) {
      console.error('Error fetching bonus points:', bonusError);
    }

    // Filter bonuses by date floor
    let filteredBonusData = bonusData || [];
    if (leagueDateFloor) {
      filteredBonusData = filteredBonusData.filter(b => {
        if (!b.course_id) return false; // Exclude bonuses without course_id in league mode
        const course = coursesMap.get(b.course_id);
        return course && course.date_debut && course.date_debut >= leagueDateFloor!;
      });
    }

    // Build rows for race points
    const raceRows = filteredPointsData.map((point: any) => {
      const key = `${point.course_id}_${point.type_classement}_${point.etape_numero || 'null'}`;
      const position = resultsMap.get(key) || null;
      const course = coursesMap.get(point.course_id);
      const isTtt = tttMap.get(key) || false;
      
      const effectivePhaseId = point.phase_id || course?.phase_id || null;
      const phase = effectivePhaseId ? phasesMap.get(effectivePhaseId) : undefined;
      const phaseIndex = phase?.index_dans_saison || 0;
      
      return {
        phase_id: effectivePhaseId,
        phase_nom: phaseIndex > 0 ? `Phase ${phaseIndex}` : 'Phase inconnue',
        phase_index: phaseIndex,
        course_nom: course?.nom || 'Inconnu',
        course_categorie: course?.categorie || '',
        course_date: course?.date_fin || course?.date_debut || null,
        type_classement: point.type_classement,
        etape_numero: point.etape_numero,
        position,
        points: point.points || 0,
        is_bonus: false,
        is_ttt: isTtt,
      };
    });

    // Build rows for bonus points
    const bonusRows = filteredBonusData.map((bonus: any) => {
      const phase = bonus.phase_id ? phasesMap.get(bonus.phase_id) : undefined;
      const phaseIndex = phase?.index_dans_saison || 0;
      
      return {
        phase_id: bonus.phase_id || null,
        phase_nom: phaseIndex > 0 ? `Phase ${phaseIndex}` : 'Phase inconnue',
        phase_index: phaseIndex,
        course_nom: 'Bonus',
        type_classement: bonus.bonus_type || 'bonus',
        commentaire: bonus.commentaire,
        points: bonus.points || 0,
        date_classement: bonus.created_at,
        is_bonus: true,
        is_ttt: false,
      };
    });

    // Combine and sort
    const allRows = [...raceRows, ...bonusRows];
    allRows.sort((a, b) => {
      const phaseCompare = a.phase_index - b.phase_index;
      if (phaseCompare !== 0) return phaseCompare;

      const aDate = 'course_date' in a ? a.course_date : null;
      const bDate = 'course_date' in b ? b.course_date : null;
      
      if (aDate && bDate) {
        const dateCompare = new Date(aDate).getTime() - new Date(bDate).getTime();
        if (dateCompare !== 0) return dateCompare;
      }

      return 0;
    });

    // Calculate total
    const total = allRows.reduce((sum, row) => sum + row.points, 0);

    console.log(`Returning ${allRows.length} rows for rider ${rider_id}, total: ${total}`);

    return new Response(JSON.stringify({
      rider: {
        id: riderData.id,
        nom: riderData.nom,
        equipe: equipe,
        total_points: total,
      },
      rows: allRows,
      total,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-rider-points-table:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
