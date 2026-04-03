import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Check superadmin role
    const { data: isSuperAdmin } = await supabase.rpc('is_superadmin');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: réservé aux superadministrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_id } = await req.json();

    if (!course_id) {
      return new Response(JSON.stringify({ error: 'course_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get course info
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, nom, categorie, type_course, phase_id')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      return new Response(JSON.stringify({ error: 'Course not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get saison_id from phase
    const { data: phaseData } = await supabase
      .from('phases')
      .select('saison_id')
      .eq('id', course.phase_id)
      .single();

    if (!phaseData) {
      return new Response(JSON.stringify({ error: 'Phase not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get number of stages from race_results
    const { data: stagesData } = await supabase
      .from('race_results')
      .select('etape_numero')
      .eq('course_id', course_id)
      .eq('type_classement', 'Etape')
      .not('etape_numero', 'is', null)
      .order('etape_numero', { ascending: true });

    let nb_etapes: number;

    // Special case: WT GT always has 21 stages
    if (course.categorie === 'WT GT') {
      nb_etapes = 21;
    } else {
      // Normal calculation: max of existing stages
      nb_etapes = stagesData && stagesData.length > 0 
        ? Math.max(...stagesData.map(s => s.etape_numero))
        : 0;
    }

    // Calculate required top positions for GC based on scoring rules
    const { data: gcRules } = await supabase
      .from('scoring_rules_saisons')
      .select('place')
      .eq('saison_id', phaseData.saison_id)
      .eq('categorie', course.categorie)
      .eq('type_classement', 'General')
      .order('place', { ascending: false })
      .limit(1);

    const required_top = gcRules && gcRules.length > 0 && gcRules[0].place >= 15 ? 15 : 10;

    // Get required jerseys from scoring rules
    const { data: jerseyRules } = await supabase
      .from('scoring_rules_saisons')
      .select('type_classement')
      .eq('saison_id', phaseData.saison_id)
      .eq('categorie', course.categorie)
      .in('type_classement', ['General', 'Points', 'Montagne', 'Jeune']);

    const required_jerseys = [...new Set(jerseyRules?.map(r => r.type_classement) || ['General'])];

    // Get stage completion status
    const stages = [];
    let all_stages_complete = true;

    for (let i = 1; i <= nb_etapes; i++) {
      // Check if stage is cancelled
      const { data: cancelledData } = await supabase
        .from('race_result_sets')
        .select('id')
        .eq('course_id', course_id)
        .eq('type_classement', 'Etape')
        .eq('etape_numero', i)
        .eq('is_cancelled', true)
        .maybeSingle();

      const is_cancelled = !!cancelledData;

      if (is_cancelled) {
        // Cancelled stage = considered complete
        stages.push({
          etape_numero: i,
          is_cancelled: true,
          is_top10_complete: true,
          has_leader: true,
          has_points_leader: true,
          has_montagne_leader: true,
          is_complete: true
        });
        continue;
      }

      // Normal logic for non-cancelled stages
      // Check top 10 for stage
      const { data: stageTop10 } = await supabase
        .from('race_results')
        .select('id')
        .eq('course_id', course_id)
        .eq('type_classement', 'Etape')
        .eq('etape_numero', i)
        .gte('position', 1)
        .lte('position', 10);

      const is_top10_complete = stageTop10 && stageTop10.length === 10;

      // Check leaders after stage
      const { data: generalLeader } = await supabase
        .from('race_results')
        .select('id')
        .eq('course_id', course_id)
        .eq('type_classement', 'General')
        .eq('etape_numero', i)
        .eq('position', 1)
        .maybeSingle();

      const { data: pointsLeader } = await supabase
        .from('race_results')
        .select('id')
        .eq('course_id', course_id)
        .eq('type_classement', 'Points')
        .eq('etape_numero', i)
        .eq('position', 1)
        .maybeSingle();

      const { data: montagneLeader } = await supabase
        .from('race_results')
        .select('id')
        .eq('course_id', course_id)
        .eq('type_classement', 'Montagne')
        .eq('etape_numero', i)
        .eq('position', 1)
        .maybeSingle();

      const has_leader = !!generalLeader;
      const has_points_leader = !!pointsLeader;
      const has_montagne_leader = !!montagneLeader;

      const stage_complete = is_top10_complete && has_leader && has_points_leader && has_montagne_leader;
      if (!stage_complete) all_stages_complete = false;

      stages.push({
        etape_numero: i,
        is_top10_complete,
        has_leader,
        has_points_leader,
        has_montagne_leader,
        is_complete: stage_complete
      });
    }

    const overview = {
      course: {
        id: course.id,
        nom: course.nom,
        categorie: course.categorie,
        nb_etapes
      },
      stages,
      gc_requirements: {
        required_top,
        required_jerseys,
        all_stages_complete
      }
    };

    return new Response(JSON.stringify(overview), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-stage-overview:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
