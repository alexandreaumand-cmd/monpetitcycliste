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

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { limit = 6 } = await req.json();

    // Get recent races with results from view
    const { data: recentCourses, error: coursesError } = await supabase
      .from('v_home_recent_results')
      .select('course_id, course_nom, date_fin, total_points')
      .order('date_fin', { ascending: false })
      .limit(limit);

    if (coursesError) {
      console.error('Error fetching recent courses:', coursesError);
      throw coursesError;
    }

    if (!recentCourses || recentCourses.length === 0) {
      return new Response(JSON.stringify({ races: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract all course IDs for batch queries
    const courseIds = recentCourses.map(c => c.course_id);

    // BATCH 1: Get all top 10 results for all courses at once
    const { data: allTop10, error: top10Error } = await supabase
      .from('race_results')
      .select(`
        course_id,
        position,
        coureur_id,
        coureurs!inner(nom),
        equipes_saisons(nom_affiche)
      `)
      .in('course_id', courseIds)
      .eq('type_classement', 'General')
      .is('etape_numero', null)
      .lte('position', 10)
      .order('position', { ascending: true });

    // BATCH 1b: Get points from points_ledger for these courses
    const { data: allPoints, error: pointsError } = await supabase
      .from('points_ledger')
      .select('course_id, coureur_id, points, type_classement, etape_numero')
      .in('course_id', courseIds)
      .eq('type_classement', 'General')
      .is('etape_numero', null);

    if (pointsError) {
      console.error('Error fetching points:', pointsError);
    }

    // Build points lookup map: course_id:coureur_id -> points
    const pointsMap = new Map<string, number>();
    (allPoints || []).forEach((p: any) => {
      pointsMap.set(`${p.course_id}:${p.coureur_id}`, p.points || 0);
    });

    if (top10Error) {
      console.error('Error fetching batch top 10:', top10Error);
    }

    // BATCH 2: Get all metadata (types + stages) for all courses at once
    const { data: allMetadata, error: metaError } = await supabase
      .from('race_results')
      .select('course_id, type_classement, etape_numero')
      .in('course_id', courseIds);

    if (metaError) {
      console.error('Error fetching batch metadata:', metaError);
    }

    // Build maps for O(1) access
    const top10Map = new Map<string, any[]>();
    const typesMap = new Map<string, Set<string>>();
    const stagesMap = new Map<string, Set<number>>();

    // Initialize maps for all courses
    courseIds.forEach(id => {
      top10Map.set(id, []);
      typesMap.set(id, new Set());
      stagesMap.set(id, new Set());
    });

    // Populate top10 map with points from points_ledger
    (allTop10 || []).forEach((r: any) => {
      const arr = top10Map.get(r.course_id) || [];
      const points = pointsMap.get(`${r.course_id}:${r.coureur_id}`) || 0;
      arr.push({
        position: r.position,
        coureur_nom: r.coureurs?.nom || 'Inconnu',
        coureur_equipe: r.equipes_saisons?.nom_affiche || '',
        points: points
      });
      top10Map.set(r.course_id, arr);
    });

    // Populate types and stages maps
    (allMetadata || []).forEach((r: any) => {
      if (r.etape_numero === null && r.type_classement) {
        typesMap.get(r.course_id)?.add(r.type_classement);
      }
      if (r.type_classement === 'Etape' && r.etape_numero !== null) {
        stagesMap.get(r.course_id)?.add(r.etape_numero);
      }
    });

    // Build final results using maps (no additional queries)
    const racesWithTop10 = recentCourses.map((course) => {
      const top10 = top10Map.get(course.course_id) || [];
      const uniqueTypes = [...(typesMap.get(course.course_id) || [])];
      const uniqueStages = [...(stagesMap.get(course.course_id) || [])].sort((a, b) => a - b);

      return {
        course_id: course.course_id,
        course_nom: course.course_nom,
        date_fin: course.date_fin,
        total_points: course.total_points,
        top10: top10,
        types_disponibles: uniqueTypes,
        etapes_disponibles: uniqueStages
      };
    });

    return new Response(JSON.stringify({ races: racesWithTop10 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in home-recent-results-top10:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
