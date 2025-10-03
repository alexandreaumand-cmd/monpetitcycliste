import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { course_id, rows } = await req.json();

    if (!course_id || !rows || !Array.isArray(rows)) {
      throw new Error('Invalid request: course_id and rows required');
    }

    console.log(`Saving one-day results for course ${course_id}: ${rows.length} rows`);

    // Get course info
    const { data: course, error: courseError } = await supabaseClient
      .from('courses')
      .select('phase_id, categorie, date_fin, date_debut')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${course_id}`);
    }

    const dateClassement = course.date_fin || course.date_debut;

    // 1. Delete existing results for this course (General classification)
    const { error: deleteError } = await supabaseClient
      .from('race_results')
      .delete()
      .eq('course_id', course_id)
      .eq('type_classement', 'General');

    if (deleteError) {
      console.error('Error deleting existing results:', deleteError);
      throw deleteError;
    }

    console.log('Deleted existing results');

    // 2. Insert new results
    const resultsToInsert = [];
    
    for (const row of rows) {
      // Get manager_id from rosters
      const { data: roster } = await supabaseClient
        .from('rosters')
        .select('manager_id')
        .eq('coureur_id', row.coureur_id)
        .eq('phase_id', course.phase_id)
        .single();

      resultsToInsert.push({
        course_id: course_id,
        type_classement: 'General',
        coureur_id: row.coureur_id,
        position: row.position,
        statut: row.statut,
        date_classement: dateClassement,
        manager_id: roster?.manager_id || null,
        points: 0, // Will be computed by compute-points
        etape_numero: null
      });
    }

    const { error: insertError } = await supabaseClient
      .from('race_results')
      .insert(resultsToInsert);

    if (insertError) {
      console.error('Error inserting results:', insertError);
      throw insertError;
    }

    console.log(`Inserted ${resultsToInsert.length} results`);

    // 3. Trigger points calculation
    console.log('Triggering points calculation...');
    
    const { error: computeError } = await supabaseClient.functions.invoke('compute-points', {
      body: { course_id }
    });

    if (computeError) {
      console.error('Error computing points:', computeError);
      // Don't throw - results are saved, points can be recalculated later
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        rows_inserted: resultsToInsert.length,
        course_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in admin-oneday-save:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
