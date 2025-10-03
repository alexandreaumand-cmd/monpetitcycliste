import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  saison_id?: string | null;
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

    const { saison_id }: RequestBody = await req.json();

    console.log('Getting filter options for saison:', saison_id);

    // Get unique categories from courses with results
    let categoriesQuery = supabaseClient
      .from('courses')
      .select('categorie')
      .not('categorie', 'is', null);

    if (saison_id) {
      const { data: phaseIds } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phaseIds && phaseIds.length > 0) {
        categoriesQuery = categoriesQuery.in('phase_id', phaseIds.map(p => p.id));
      }
    }

    const { data: categoriesData, error: categoriesError } = await categoriesQuery;

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw categoriesError;
    }

    const categories = Array.from(
      new Set(categoriesData?.map(c => c.categorie).filter(Boolean) || [])
    ).sort();

    const classement_types = ['Etape', 'General', 'Points', 'Montagne', 'Jeune'];

    return new Response(
      JSON.stringify({
        categories,
        classement_types
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in courses-filter-options:', error);
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
