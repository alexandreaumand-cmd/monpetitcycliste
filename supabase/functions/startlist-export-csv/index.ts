import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { startlist_id } = await req.json();

    console.log('Exporting CSV for startlist:', startlist_id);

    // Use the manager view function
    const { data: viewData, error: viewError } = await supabase.functions.invoke(
      'startlist-manager-view',
      { body: { startlist_id } }
    );

    if (viewError) throw viewError;

    // Build CSV
    let csv = 'Manager,Coureur,Equipe,Dossard\n';
    
    for (const manager of viewData.managers) {
      for (const starter of manager.starters) {
        const row = [
          manager.manager_nom,
          starter.nom,
          starter.equipe || '',
          starter.bib_no || ''
        ].map(field => `"${field}"`).join(',');
        csv += row + '\n';
      }
    }

    console.log('CSV generated, rows:', viewData.totals.starters_all);

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="startlist_${viewData.race.id}.csv"`
      }
    });

  } catch (error) {
    console.error('Error in startlist-export-csv:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
