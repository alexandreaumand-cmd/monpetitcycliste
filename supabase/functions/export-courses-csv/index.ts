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
    const { phase_id, saison_id } = body;

    // Build query
    let query = supabase
      .from('courses')
      .select('id, nom, categorie, type_course, date_debut, date_fin, phase_id, phases(saison_id)')
      .order('date_debut', { ascending: true });

    if (phase_id) {
      query = query.eq('phase_id', phase_id);
    } else if (saison_id) {
      query = query.eq('phases.saison_id', saison_id);
    }

    const { data: courses, error } = await query;

    if (error) throw error;

    console.log(`Total courses fetched: ${courses?.length || 0}`);

    // Generate CSV
    const headers = ['id', 'nom', 'categorie', 'type_course', 'date_debut', 'date_fin', 'phase_id'];
    let csv = headers.join(';') + '\n';

    for (const course of courses || []) {
      const row = [
        course.id || '',
        `"${(course.nom || '').replace(/"/g, '""')}"`,
        course.categorie || '',
        course.type_course || '',
        course.date_debut || '',
        course.date_fin || '',
        course.phase_id || ''
      ];
      csv += row.join(';') + '\n';
    }

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="courses_export.csv"',
      },
    });

  } catch (error) {
    console.error('Error in export-courses-csv:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
