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

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all coureurs (jusqu'à 10000)
    const { data: coureurs, error } = await supabase
      .from('coureurs')
      .select('id, nom, equipe, prix_initial')
      .order('nom', { ascending: true })
      .range(0, 9999);

    if (error) throw error;

    // Generate CSV
    const headers = ['id', 'nom', 'equipe', 'prix_initial'];
    let csv = headers.join(',') + '\n';

    for (const coureur of coureurs || []) {
      const row = [
        coureur.id || '',
        `"${(coureur.nom || '').replace(/"/g, '""')}"`,
        `"${(coureur.equipe || '').replace(/"/g, '""')}"`,
        coureur.prix_initial || '0'
      ];
      csv += row.join(',') + '\n';
    }

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="coureurs_export.csv"',
      },
    });

  } catch (error) {
    console.error('Error in export-coureurs-csv:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
