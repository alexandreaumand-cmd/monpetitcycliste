import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  course_id: string;
}

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

    const { course_id }: RequestBody = await req.json();

    if (!course_id) {
      throw new Error('course_id is required');
    }

    console.log('Getting stages for course:', course_id);

    // Get distinct stage numbers from race_results
    const { data, error } = await supabaseClient
      .from('race_results')
      .select('etape_numero')
      .eq('course_id', course_id)
      .eq('type_classement', 'Etape')
      .not('etape_numero', 'is', null)
      .order('etape_numero', { ascending: true });

    if (error) throw error;

    const stages = Array.from(new Set(data?.map(d => d.etape_numero).filter(Boolean) || [])).sort((a, b) => a - b);

    return new Response(
      JSON.stringify({ stages }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in course-stages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
