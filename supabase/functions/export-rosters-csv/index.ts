import { createClient } from 'npm:@supabase/supabase-js@2';
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
    const { phase_id } = body;

    // Build query
    let query = supabase
      .from('rosters')
      .select('*, coureurs(nom), managers(nom), phases(index_dans_saison)')
      .order('managers(nom)', { ascending: true });

    if (phase_id) {
      query = query.eq('phase_id', phase_id);
    }

    const { data: rosters, error } = await query;

    if (error) throw error;

    console.log(`Total rosters fetched: ${rosters?.length || 0}`);

    // Generate CSV
    const headers = ['Coureur', 'Propriétaire', 'Phase', 'Prix'];
    let csv = headers.join(';') + '\n';

    for (const roster of rosters || []) {
      const row = [
        `"${(roster.coureurs?.nom || '').replace(/"/g, '""')}"`,
        `"${(roster.managers?.nom || '').replace(/"/g, '""')}"`,
        `Phase ${roster.phases?.index_dans_saison || ''}`,
        roster.prix_signature || '0'
      ];
      csv += row.join(';') + '\n';
    }

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="rosters_export.csv"',
      },
    });

  } catch (error) {
    console.error('Error in export-rosters-csv:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
