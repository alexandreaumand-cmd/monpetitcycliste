import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Non authentifié');
    }

    // Check superadmin access
    const { data: isSuperAdmin, error: adminError } = await supabaseClient.rpc('is_superadmin');
    if (adminError || !isSuperAdmin) {
      throw new Error('Accès refusé: réservé aux superadministrateurs');
    }

    const { saison_id, confirm_phrase } = await req.json();

    // Verify confirmation phrase
    if (confirm_phrase !== 'RESET SAISON RESULTS') {
      throw new Error('Phrase de confirmation incorrecte');
    }

    // Get all phases of this season
    const { data: phases, error: phasesError } = await supabaseClient
      .from('phases')
      .select('id')
      .eq('saison_id', saison_id);

    if (phasesError) throw phasesError;

    const phaseIds = phases?.map(p => p.id) || [];

    if (phaseIds.length === 0) {
      throw new Error('Aucune phase trouvée pour cette saison');
    }

    // Get all courses of these phases
    const { data: courses, error: coursesError } = await supabaseClient
      .from('courses')
      .select('id')
      .in('phase_id', phaseIds);

    if (coursesError) throw coursesError;

    const courseIds = courses?.map(c => c.id) || [];

    if (courseIds.length === 0) {
      throw new Error('Aucune course trouvée pour cette saison');
    }

    // Delete race_results for these courses
    const { error: deleteResultsError, count: deletedResults } = await supabaseClient
      .from('race_results')
      .delete({ count: 'exact' })
      .in('course_id', courseIds);

    if (deleteResultsError) throw deleteResultsError;

    // Delete points_ledger for these courses
    const { error: deletePointsError, count: deletedPoints } = await supabaseClient
      .from('points_ledger')
      .delete({ count: 'exact' })
      .in('course_id', courseIds);

    if (deletePointsError) throw deletePointsError;

    // Get manager ID for audit log
    const { data: manager } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Log audit
    if (manager) {
      await supabaseClient.from('audits').insert({
        actor_manager_id: manager.id,
        action: 'admin_reset_season_results',
        payload_json: JSON.stringify({
          saison_id,
          courses_affected: courseIds.length,
          results_deleted: deletedResults || 0,
          points_deleted: deletedPoints || 0,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        saison_id,
        courses_affected: courseIds.length,
        results_deleted: deletedResults || 0,
        points_deleted: deletedPoints || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
