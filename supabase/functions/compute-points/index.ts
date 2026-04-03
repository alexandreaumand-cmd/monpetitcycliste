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

    const { course_id, phase_id } = await req.json();

    if (!course_id && !phase_id) {
      throw new Error('Either course_id or phase_id is required');
    }

    let result;

    if (course_id) {
      // Compute points for a single course
      console.log(`Computing points for course: ${course_id}`);
      const { data, error } = await supabaseClient.rpc('admin_compute_points_for_course', {
        p_course_id: course_id
      });

      if (error) throw error;
      result = data;
    } else {
      // Compute points for entire phase
      console.log(`Computing points for phase: ${phase_id}`);
      const { data, error } = await supabaseClient.rpc('admin_recompute_points_for_phase', {
        p_phase_id: phase_id
      });

      if (error) throw error;
      result = data;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error computing points:', error);
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
