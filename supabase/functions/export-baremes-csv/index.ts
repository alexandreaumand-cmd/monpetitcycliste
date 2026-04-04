import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Parse request body for filters
    const body = await req.json().catch(() => ({}));
    const { saison_id } = body;

    // Build query
    let query = supabase
      .from('scoring_rules_saisons')
      .select('*')
      .order('categorie', { ascending: true })
      .order('type_classement', { ascending: true })
      .order('place', { ascending: true });

    if (saison_id) {
      query = query.eq('saison_id', saison_id);
    }

    const { data: baremes, error } = await query;

    if (error) throw error;

    console.log(`Total baremes fetched: ${baremes?.length || 0}`);

    // Generate CSV
    const headers = ['id', 'Catégorie', 'Type classement', 'Place', 'Points', 'Type', 'saison_id'];
    let csv = headers.join(';') + '\n';

    for (const bareme of baremes || []) {
      const row = [
        bareme.id || '',
        bareme.categorie || '',
        bareme.type_classement || '',
        bareme.place || '',
        bareme.points || '',
        bareme.type || '',
        bareme.saison_id || ''
      ];
      csv += row.join(';') + '\n';
    }

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="baremes_export.csv"',
      },
    });

  } catch (error) {
    console.error('Error in export-baremes-csv:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
