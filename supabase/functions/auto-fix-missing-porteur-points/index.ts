import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const responseHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-cron-secret`,
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: responseHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

    // --- Auth gate: cron secret OR authenticated superadmin ---
    const cronHeader = req.headers.get('x-cron-secret');
    const isCronCall = Boolean(CRON_SECRET && cronHeader && cronHeader === CRON_SECRET);

    let actorManagerId: string | null = null;

    if (!isCronCall) {
      const authHeader = req.headers.get('Authorization') ?? '';
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Non authentifié' }),
          { status: 401, headers: responseHeaders }
        );
      }

      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Non authentifié' }),
          { status: 401, headers: responseHeaders }
        );
      }

      const { data: isSuperAdmin, error: roleError } = await userClient.rpc('is_superadmin');
      if (roleError || !isSuperAdmin) {
        console.error('Superadmin check failed:', roleError);
        return new Response(
          JSON.stringify({ error: 'Accès refusé: réservé aux superadministrateurs' }),
          { status: 403, headers: responseHeaders }
        );
      }

      const { data: currentManager } = await userClient
        .from('managers')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      actorManagerId = currentManager?.id ?? null;
    }

    // Privileged client — only created after authorization succeeded
    const supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    console.log('Starting auto-fix for missing Porteur points...');

    // Find all courses with Porteur results but missing points in ledger
    const { data: coursesWithMissingPoints, error: queryError } = await supabaseClient.rpc(
      'find_courses_missing_porteur_points'
    );

    if (queryError) {
      console.error('Error finding courses with missing points:', queryError);
      throw queryError;
    }

    console.log(`Found ${coursesWithMissingPoints?.length || 0} courses with missing Porteur points`);

    const results = [];
    let totalPointsAdded = 0;

    // Process each course
    for (const course of coursesWithMissingPoints || []) {
      console.log(`Processing course: ${course.course_id} (${course.course_nom})`);

      const { data: computeResult, error: computeError } = await supabaseClient.rpc(
        'admin_compute_points_for_course',
        { p_course_id: course.course_id }
      );

      if (computeError) {
        console.error(`Error computing points for ${course.course_id}:`, computeError);
        results.push({
          course_id: course.course_id,
          course_nom: course.course_nom,
          success: false,
          error: computeError.message
        });
      } else {
        console.log(`Successfully computed points for ${course.course_id}:`, computeResult);
        totalPointsAdded += computeResult.rows_upserted || 0;
        results.push({
          course_id: course.course_id,
          course_nom: course.course_nom,
          success: true,
          rows_upserted: computeResult.rows_upserted,
          missing_bareme: computeResult.missing_bareme
        });
      }
    }

    const summary = {
      courses_processed: results.length,
      total_points_added: totalPointsAdded,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      errors_count: results.filter(r => !r.success).length,
      results
    };

    console.log('Auto-fix summary:', summary);

    // Audit log
    try {
      await supabaseClient.from('audits').insert({
        actor_manager_id: actorManagerId,
        action: 'auto_fix_missing_porteur_points',
        payload_json: JSON.stringify({
          via: isCronCall ? 'cron' : 'superadmin',
          courses_processed: summary.courses_processed,
          total_points_added: summary.total_points_added,
          failed: summary.failed,
        })
      });
    } catch (auditError) {
      console.error('Audit log failed:', auditError);
    }

    return new Response(
      JSON.stringify(summary),
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error('Error in auto-fix-missing-porteur-points:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: responseHeaders }
    );
  }
});
