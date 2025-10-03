import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { course_id, phase_id } = await req.json();

    if (!course_id && !phase_id) {
      return new Response(
        JSON.stringify({ error: 'course_id ou phase_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    if (course_id) {
      console.log('Computing points for course:', course_id);
      const { data, error } = await supabase.rpc('admin_compute_points_for_course', {
        p_course_id: course_id
      });

      if (error) throw error;
      result = data;

      console.log('Points computed:', {
        course_id,
        rows_upserted: result.rows_upserted,
        missing_bareme_count: result.missing_bareme?.length || 0
      });
    } else if (phase_id) {
      console.log('Computing points for phase:', phase_id);
      const { data, error } = await supabase.rpc('admin_recompute_points_for_phase', {
        p_phase_id: phase_id
      });

      if (error) throw error;
      result = data;

      console.log('Phase points computed:', {
        phase_id,
        courses_processed: result.courses_processed,
        total_rows: result.total_rows
      });
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in compute-points:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
