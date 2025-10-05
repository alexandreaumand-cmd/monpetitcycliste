import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
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

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_id, context, etape_numero = null } = await req.json();

    if (!course_id || !context || !['Etape', 'CG'].includes(context)) {
      return new Response(JSON.stringify({ error: 'Invalid parameters' }), {
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

    // Determine nb_etapes from race_results
    const { data: stagesData } = await supabase
      .from('race_results')
      .select('etape_numero')
      .eq('course_id', course_id)
      .eq('type_classement', 'Etape')
      .not('etape_numero', 'is', null);

    const nb_etapes = stagesData && stagesData.length > 0 
      ? Math.max(...stagesData.map(s => s.etape_numero))
      : 0;

    const result: any = {
      course: { ...course, nb_etapes },
      context
    };

    if (context === 'Etape') {
      if (!etape_numero) {
        return new Response(JSON.stringify({ error: 'etape_numero required for Etape context' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      result.stage = { etape_numero };

      // Load top 10
      const { data: top10Data } = await supabase
        .from('race_results')
        .select('position, coureur_id, updated_at, updated_by_manager_id')
        .eq('course_id', course_id)
        .eq('type_classement', 'Etape')
        .eq('etape_numero', etape_numero)
        .gte('position', 1)
        .lte('position', 10)
        .order('position', { ascending: true });

      // Create array with all 10 positions
      const top10_base = Array.from({ length: 10 }, (_, i) => {
        const position = i + 1;
        const found = top10Data?.find(t => t.position === position);
        return {
          position,
          coureur_id: found?.coureur_id || null
        };
      });

      result.top10_base = top10_base;

      // Load leaders after stage
      const { data: leadersData } = await supabase
        .from('race_results')
        .select('type_classement, coureur_id')
        .eq('course_id', course_id)
        .eq('etape_numero', etape_numero)
        .eq('position', 1)
        .in('type_classement', ['General', 'Points', 'Montagne']);

      const leaders_base = {
        general_leader_id: leadersData?.find(l => l.type_classement === 'General')?.coureur_id || null,
        points_leader_id: leadersData?.find(l => l.type_classement === 'Points')?.coureur_id || null,
        montagne_leader_id: leadersData?.find(l => l.type_classement === 'Montagne')?.coureur_id || null
      };

      result.leaders_base = leaders_base;

      const hasTop10 = top10_base.every(t => t.coureur_id !== null);
      const hasLeaders = leaders_base.general_leader_id && leaders_base.points_leader_id && leaders_base.montagne_leader_id;
      result.is_stage_complete = hasTop10 && hasLeaders;

    } else if (context === 'CG') {
      // Determine required_top from scoring_rules
      const { data: gcRules } = await supabase
        .from('scoring_rules')
        .select('place')
        .eq('categorie', course.categorie)
        .eq('type_classement', 'General')
        .order('place', { ascending: false })
        .limit(1);

      const required_top = gcRules && gcRules.length > 0 && gcRules[0].place >= 15 ? 15 : 10;
      result.required_top = required_top;

      // Load general classification top
      const { data: gcTopData } = await supabase
        .from('race_results')
        .select('position, coureur_id')
        .eq('course_id', course_id)
        .eq('type_classement', 'General')
        .is('etape_numero', null)
        .gte('position', 1)
        .lte('position', required_top)
        .order('position', { ascending: true });

      const general_top_base = Array.from({ length: required_top }, (_, i) => {
        const position = i + 1;
        const found = gcTopData?.find(t => t.position === position);
        return {
          position,
          coureur_id: found?.coureur_id || null
        };
      });

      result.general_top_base = general_top_base;

      // Load jersey winners
      const { data: jerseyData } = await supabase
        .from('race_results')
        .select('type_classement, coureur_id')
        .eq('course_id', course_id)
        .is('etape_numero', null)
        .eq('position', 1)
        .in('type_classement', ['General', 'Points', 'Montagne', 'Jeune']);

      const jersey_winners_base = {
        general_winner_id: jerseyData?.find(j => j.type_classement === 'General')?.coureur_id || null,
        points_winner_id: jerseyData?.find(j => j.type_classement === 'Points')?.coureur_id || null,
        montagne_winner_id: jerseyData?.find(j => j.type_classement === 'Montagne')?.coureur_id || null,
        jeune_winner_id: jerseyData?.find(j => j.type_classement === 'Jeune')?.coureur_id || null
      };

      result.jersey_winners_base = jersey_winners_base;

      // Check stage completion status
      const stages_status = [];
      for (let i = 1; i <= nb_etapes; i++) {
        const { data: stageTop10 } = await supabase
          .from('race_results')
          .select('id')
          .eq('course_id', course_id)
          .eq('type_classement', 'Etape')
          .eq('etape_numero', i)
          .gte('position', 1)
          .lte('position', 10);

        const { data: stageLeaders } = await supabase
          .from('race_results')
          .select('id')
          .eq('course_id', course_id)
          .eq('etape_numero', i)
          .eq('position', 1)
          .in('type_classement', ['General', 'Points', 'Montagne']);

        stages_status.push({
          etape_numero: i,
          has_top10: stageTop10 && stageTop10.length === 10,
          has_leaders: stageLeaders && stageLeaders.length === 3
        });
      }

      result.stages_status = stages_status;
      result.all_stages_complete_for_cg = stages_status.every(s => s.has_top10 && s.has_leaders);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-results-load:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
