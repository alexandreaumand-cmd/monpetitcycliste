import { createClient } from 'npm:@supabase/supabase-js@2';
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
      results
    };

    console.log('Auto-fix summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-fix-missing-porteur-points:', error);
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
