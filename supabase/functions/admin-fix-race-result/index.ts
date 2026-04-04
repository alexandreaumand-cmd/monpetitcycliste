import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check admin access
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) {
      throw new Error('Accès refusé: réservé aux superadministrateurs');
    }

    const { race_result_id, new_coureur_id, course_id } = await req.json();

    if (!race_result_id || !new_coureur_id) {
      throw new Error('race_result_id et new_coureur_id sont requis');
    }

    // Update the race result
    const { error: updateError } = await supabaseClient
      .from('race_results')
      .update({ coureur_id: new_coureur_id })
      .eq('id', race_result_id);

    if (updateError) throw updateError;

    // Recalculate points if course_id is provided
    if (course_id) {
      const { error: computeError } = await supabaseClient.functions.invoke('compute-points', {
        body: { course_id }
      });

      if (computeError) {
        console.error('Error computing points:', computeError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Résultat corrigé et points recalculés'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fixing race result:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
