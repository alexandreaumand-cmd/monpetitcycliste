import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { course_id, type_classement, etape_numero = null } = await req.json();

    if (!course_id || !type_classement) {
      return new Response(JSON.stringify({ error: 'course_id and type_classement are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if the stage is cancelled
    if (etape_numero !== null && etape_numero !== undefined) {
      const { data: resultSet } = await supabase
        .from('race_result_sets')
        .select('is_cancelled')
        .eq('course_id', course_id)
        .eq('type_classement', type_classement)
        .eq('etape_numero', etape_numero)
        .maybeSingle();

      if (resultSet?.is_cancelled) {
        return new Response(JSON.stringify({ rows: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: rows, error } = await supabase.rpc('results_course_rows', {
      p_course_id: course_id,
      p_type_classement: type_classement,
      p_etape_numero: etape_numero
    });

    if (error) throw error;

    return new Response(JSON.stringify({ rows: rows || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-course-rows:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
