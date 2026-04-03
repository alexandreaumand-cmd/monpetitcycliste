import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Edge function pour nettoyer une course fantôme créée par erreur
 * Supprime les résultats et points associés, puis la course elle-même
 */
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

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Non authentifié');

    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) throw new Error('Accès refusé: réservé aux super administrateurs');

    const { course_id } = await req.json();
    if (!course_id) throw new Error('course_id manquant');

    console.log(`🧹 Nettoyage de la course: ${course_id}`);

    // 1. Compter les données à supprimer
    const { count: resultsCount } = await supabaseClient
      .from('race_results')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', course_id);

    const { count: pointsCount } = await supabaseClient
      .from('points_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', course_id);

    console.log(`📊 Données trouvées: ${resultsCount} résultats, ${pointsCount} points`);

    // 2. Supprimer les résultats
    const { error: deleteResultsError } = await supabaseClient
      .from('race_results')
      .delete()
      .eq('course_id', course_id);

    if (deleteResultsError) throw deleteResultsError;
    console.log(`✅ ${resultsCount} résultats supprimés`);

    // 3. Supprimer les points
    const { error: deletePointsError } = await supabaseClient
      .from('points_ledger')
      .delete()
      .eq('course_id', course_id);

    if (deletePointsError) throw deletePointsError;
    console.log(`✅ ${pointsCount} points supprimés`);

    // 4. Récupérer les infos de la course avant suppression
    const { data: courseData } = await supabaseClient
      .from('courses')
      .select('nom, phase_id')
      .eq('id', course_id)
      .single();

    // 5. Supprimer la course
    const { error: deleteCourseError } = await supabaseClient
      .from('courses')
      .delete()
      .eq('id', course_id);

    if (deleteCourseError) throw deleteCourseError;
    console.log(`✅ Course "${courseData?.nom}" supprimée`);

    // 6. Logger l'action
    const { data: managers } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (managers?.id) {
      await supabaseClient.from('audits').insert({
        actor_manager_id: managers.id,
        action: 'cleanup_phantom_course',
        payload_json: JSON.stringify({
          course_id,
          course_name: courseData?.nom,
          results_deleted: resultsCount,
          points_deleted: pointsCount,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        course_id,
        course_name: courseData?.nom,
        deleted: {
          results: resultsCount,
          points: pointsCount,
          course: 1,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error cleaning up phantom course:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
