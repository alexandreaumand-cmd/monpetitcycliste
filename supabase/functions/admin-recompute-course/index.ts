import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Check admin access
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    const { data: isAdmin } = await supabaseClient.rpc('is_admin');
    if (!isAdmin) {
      throw new Error('Accès refusé: réservé aux administrateurs');
    }

    const { course_id } = await req.json();

    if (!course_id) {
      throw new Error('course_id est requis');
    }

    console.log(`Recalcul des points pour la course: ${course_id}`);

    // Appeler la fonction RPC pour recalculer les points
    const { data, error } = await supabaseClient.rpc('admin_compute_points_for_course', {
      p_course_id: course_id
    });

    if (error) {
      console.error('Erreur lors du recalcul des points:', error);
      throw error;
    }

    console.log('Résultat du recalcul:', data);

    return new Response(
      JSON.stringify({
        success: true,
        ...data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur dans admin-recompute-course:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
