import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
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

    // Check admin access
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc('is_admin');
    if (adminError || !isAdmin) {
      throw new Error('Accès refusé: réservé aux administrateurs');
    }

    const { course_id, confirm_phrase } = await req.json();

    // Verify confirmation phrase
    if (confirm_phrase !== `RESET COURSE ${course_id}`) {
      throw new Error('Phrase de confirmation incorrecte');
    }

    // Delete race_results for this course
    const { error: deleteResultsError, count: deletedResults } = await supabaseClient
      .from('race_results')
      .delete({ count: 'exact' })
      .eq('course_id', course_id);

    if (deleteResultsError) throw deleteResultsError;

    // Delete points_ledger for this course
    const { error: deletePointsError, count: deletedPoints } = await supabaseClient
      .from('points_ledger')
      .delete({ count: 'exact' })
      .eq('course_id', course_id);

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
        action: 'admin_reset_course_results',
        payload_json: JSON.stringify({
          course_id,
          results_deleted: deletedResults || 0,
          points_deleted: deletedPoints || 0,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        course_id,
        results_deleted: deletedResults || 0,
        points_deleted: deletedPoints || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
