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

    const { rider_id, saison_id, phase_id } = await req.json();

    if (!rider_id) {
      throw new Error('rider_id is required');
    }

    console.log('Fetching rider points table:', { rider_id, saison_id, phase_id });

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

    // Get team for the season
    let equipe = 'N/A';
    if (targetSaisonId) {
      const { data: seasonData } = await supabase
        .from('coureurs_saisons')
        .select('equipe')
        .eq('coureur_id', rider_id)
        .eq('saison_id', targetSaisonId)
        .maybeSingle();
      equipe = seasonData?.equipe || 'N/A';
    }

    // Build query for points with joins
    let query = supabase
      .from('points_ledger')
      .select(`
        points,
        phase_id,
        course_id,
        type_classement,
        etape_numero,
        phases:phase_id (
          index_dans_saison,
          saison_id
        ),
        courses:course_id (
          nom,
          date_debut
        )
      `)
      .eq('coureur_id', rider_id);

    // Apply filters
    if (phase_id) {
      query = query.eq('phase_id', phase_id);
    } else if (saison_id) {
      // Filter by saison through phase
      const { data: phases } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        query = query.in('phase_id', phaseIds);
      }
    }

    const { data: pointsData, error: pointsError } = await query.limit(200);

    if (pointsError) {
      console.error('Error fetching points:', pointsError);
      throw pointsError;
    }

    // Get race_results to find positions
    const courseIds = [...new Set(pointsData?.map(p => p.course_id) || [])];
    
    const { data: resultsData, error: resultsError } = await supabase
      .from('race_results')
      .select('course_id, type_classement, etape_numero, position')
      .eq('coureur_id', rider_id)
      .in('course_id', courseIds);

    if (resultsError) {
      console.error('Error fetching results:', resultsError);
    }

    // Build results map for quick lookup
    const resultsMap = new Map();
    resultsData?.forEach((result: any) => {
      const key = `${result.course_id}_${result.type_classement}_${result.etape_numero || 'null'}`;
      resultsMap.set(key, result.position);
    });

    // Build rows
    const rows = pointsData?.map((point: any) => {
      const key = `${point.course_id}_${point.type_classement}_${point.etape_numero || 'null'}`;
      const place = resultsMap.get(key) || null;
      
      return {
        phase_label: `Phase ${point.phases?.index_dans_saison || '?'}`,
        phase_index: point.phases?.index_dans_saison || 0,
        course_nom: point.courses?.nom || 'Inconnu',
        course_date: point.courses?.date_debut || null,
        place,
        points: point.points || 0,
      };
    }) || [];

    // Sort: phase ASC, course date ASC, place ASC (nulls last)
    rows.sort((a, b) => {
      // First by phase
      const phaseCompare = a.phase_index - b.phase_index;
      if (phaseCompare !== 0) return phaseCompare;

      // Then by course date
      if (a.course_date && b.course_date) {
        const dateCompare = new Date(a.course_date).getTime() - new Date(b.course_date).getTime();
        if (dateCompare !== 0) return dateCompare;
      }

      // Then by place (nulls last)
      if (a.place === null && b.place === null) return 0;
      if (a.place === null) return 1;
      if (b.place === null) return -1;
      return a.place - b.place;
    });

    // Calculate total
    const total = rows.reduce((sum, row) => sum + row.points, 0);

    // Remove temporary sorting fields
    const cleanRows = rows.map(({ phase_label, course_nom, place, points }) => ({
      phase_label,
      course_nom,
      place,
      points,
    }));

    console.log(`Returning ${cleanRows.length} rows for rider ${rider_id}, total: ${total}`);

    return new Response(JSON.stringify({
      rider: {
        id: riderData.id,
        nom: riderData.nom,
        equipe: equipe,
        total_points: total,
      },
      rows: cleanRows,
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
