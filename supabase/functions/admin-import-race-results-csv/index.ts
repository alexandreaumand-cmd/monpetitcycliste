import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Check admin access
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    const { data: isAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isAdmin) {
      throw new Error('Accès refusé: réservé aux super administrateurs');
    }

    const { csv_content } = await req.json();

    if (!csv_content) {
      throw new Error('Le contenu CSV est requis');
    }

    console.log('[admin-import-race-results-csv] Starting import...');

    // Parse CSV (skip header)
    const lines = csv_content.trim().split('\n');
    const headers = lines[0].split(',').map((h: string) => h.trim());
    
    console.log('[admin-import-race-results-csv] Headers:', headers);

    const results = [];
    const errors = [];
    const courseIds = new Set<string>();

    // Parse date with flexible format support
    const parseDate = (dateStr: string): string => {
      if (!dateStr) return new Date().toISOString().split('T')[0];
      
      // Try DD/MM/YYYY format
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        if (day && month && year) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
      
      // Assume YYYY-MM-DD format
      return dateStr;
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map((v: string) => v.trim());
      
      try {
        const result: any = {
          course_id: values[0] || null,
          coureur_id: values[1] || null,
          type_classement: values[2] || 'Etape',
          etape_numero: values[3] ? parseInt(values[3]) : null,
          position: values[4] ? parseInt(values[4]) : null,
          statut: values[5] || 'finished',
          date_classement: parseDate(values[6]),
          saison_id: values[7] || null,
        };

        // Validation
        if (!result.course_id) {
          errors.push({ line: i + 1, error: 'course_id manquant' });
          continue;
        }
        if (!result.coureur_id) {
          errors.push({ line: i + 1, error: 'coureur_id manquant' });
          continue;
        }
        if (!result.saison_id) {
          errors.push({ line: i + 1, error: 'saison_id manquant' });
          continue;
        }

        results.push(result);
        courseIds.add(result.course_id);
      } catch (error) {
        errors.push({ line: i + 1, error: error.message });
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Aucun résultat valide trouvé dans le CSV',
          errors 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log(`[admin-import-race-results-csv] Parsed ${results.length} valid results`);

    // Insert results in batch
    const { error: insertError, count } = await supabaseClient
      .from('race_results')
      .insert(results);

    if (insertError) {
      console.error('[admin-import-race-results-csv] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[admin-import-race-results-csv] Inserted ${count} results`);

    // Automatically recompute points for affected courses
    const recomputeResults = [];
    for (const courseId of courseIds) {
      try {
        console.log(`[admin-import-race-results-csv] Recomputing points for course ${courseId}`);
        
        const { data, error } = await supabaseClient.rpc('admin_compute_points_for_course', {
          p_course_id: courseId
        });

        if (error) {
          console.error(`[admin-import-race-results-csv] Error recomputing points for ${courseId}:`, error);
          recomputeResults.push({ course_id: courseId, success: false, error: error.message });
        } else {
          console.log(`[admin-import-race-results-csv] Successfully recomputed points for ${courseId}:`, data);
          recomputeResults.push({ course_id: courseId, success: true, data });
        }
      } catch (error) {
        console.error(`[admin-import-race-results-csv] Exception recomputing points for ${courseId}:`, error);
        recomputeResults.push({ course_id: courseId, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: count || results.length,
        courses_affected: Array.from(courseIds),
        recompute_results: recomputeResults,
        parse_errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[admin-import-race-results-csv] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
