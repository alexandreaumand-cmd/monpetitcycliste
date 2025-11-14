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

    const { course_id } = await req.json();

    if (!course_id) {
      return new Response(JSON.stringify({ error: 'course_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase.rpc('results_course_meta_v2', {
      p_course_id: course_id
    });

    if (error) throw error;

    const meta = data && data.length > 0 ? data[0] : null;

    // Filter out cancelled stages from etapes_disponibles
    if (meta && meta.etapes_disponibles && meta.etapes_disponibles.length > 0) {
      const { data: cancelledStages } = await supabase
        .from('race_result_sets')
        .select('etape_numero')
        .eq('course_id', course_id)
        .eq('type_classement', 'Etape')
        .eq('is_cancelled', true);

      if (cancelledStages && cancelledStages.length > 0) {
        const cancelledNums = cancelledStages.map(s => s.etape_numero);
        meta.etapes_disponibles = meta.etapes_disponibles.filter(
          (num: number) => !cancelledNums.includes(num)
        );
      }
    }

    return new Response(JSON.stringify({ meta }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-course-meta-v2:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
