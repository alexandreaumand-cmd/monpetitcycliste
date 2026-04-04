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
    const { course_id, saison_id } = body;

    // Build query
    let query = supabase
      .from('race_results')
      .select('course_id, coureur_id, type_classement, position, statut, etape_numero, date_classement, saison_id')
      .order('date_classement', { ascending: false })
      .order('type_classement', { ascending: true })
      .order('position', { ascending: true });

    if (course_id) {
      query = query.eq('course_id', course_id);
    } else if (saison_id) {
      query = query.eq('saison_id', saison_id);
    }

    const { data: resultats, error } = await query.limit(5000);

    if (error) throw error;

    console.log(`Total resultats fetched: ${resultats?.length || 0}`);

    // Generate CSV
    const headers = ['course_id', 'coureur_id', 'type_classement', 'position', 'statut', 'etape_numero', 'date_classement'];
    let csv = headers.join(';') + '\n';

    for (const resultat of resultats || []) {
      const row = [
        resultat.course_id || '',
        resultat.coureur_id || '',
        resultat.type_classement || '',
        resultat.position || '',
        resultat.statut || '',
        resultat.etape_numero || '',
        resultat.date_classement || ''
      ];
      csv += row.join(';') + '\n';
    }

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="resultats_export.csv"',
      },
    });

  } catch (error) {
    console.error('Error in export-resultats-csv:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
