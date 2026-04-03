import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      throw new Error('Non authentifié - header manquant');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated by getting user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError) {
      console.error('Auth error:', userError);
      throw new Error('Non authentifié - erreur auth');
    }
    
    if (!user) {
      console.error('No user found');
      throw new Error('Non authentifié - utilisateur non trouvé');
    }

    console.log('User authenticated:', user.id);

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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
