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

    // Pre-load saisons for year → UUID mapping
    const { data: saisons, error: saisonsError } = await supabaseClient
      .from('saisons')
      .select('id, annee');
    
    if (saisonsError) {
      console.error('[admin-import-race-results-csv] Error loading saisons:', saisonsError);
      throw new Error('Impossible de charger les saisons');
    }

    const saisonCache = new Map<string, string>(
      (saisons || []).map(s => [s.annee.toString(), s.id])
    );
    
    console.log('[admin-import-race-results-csv] Loaded saisons:', Array.from(saisonCache.keys()));

    // Resolve saison_id from UUID or year
    const resolveSaisonId = (value: string): string | null => {
      if (!value) return null;
      
      const trimmed = value.trim();
      
      // If it contains dashes, assume it's a UUID
      if (trimmed.includes('-')) {
        return trimmed;
      }
      
      // Otherwise, treat as year and lookup in cache
      return saisonCache.get(trimmed) || null;
    };

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
        const resolvedSaisonId = resolveSaisonId(values[7]);
        
        const result: any = {
          course_id: values[0] || null,
          coureur_id: values[1] || null,
          type_classement: values[2] || 'Etape',
          etape_numero: values[3] ? parseInt(values[3]) : null,
          position: values[4] ? parseInt(values[4]) : null,
          statut: values[5] || 'finished',
          date_classement: parseDate(values[6]),
          saison_id: resolvedSaisonId,
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
          errors.push({ 
            line: i + 1, 
            error: `saison_id manquant ou année '${values[7]}' non trouvée` 
          });
          continue;
        }

        results.push(result);
        courseIds.add(result.course_id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ line: i + 1, error: errorMessage });
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[admin-import-race-results-csv] Exception recomputing points for ${courseId}:`, error);
        recomputeResults.push({ course_id: courseId, success: false, error: errorMessage });
      }
    }

    // Send ONE push notification per course (not per type_classement)
    // Only for Etape and General types (not jersey wearers)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && serviceRoleKey) {
      for (const courseId of courseIds) {
        try {
          // Check if this course has any Etape or General results in the import
          const relevantResults = results.filter(
            r => r.course_id === courseId && 
            (r.type_classement === 'Etape' || r.type_classement === 'General' || r.type_classement === 'GC')
          );
          
          if (relevantResults.length === 0) {
            console.log(`[admin-import-race-results-csv] Skipping push for ${courseId} - no Etape/General results`);
            continue;
          }
          
          // Get course name for the notification
          const { data: courseData } = await supabaseClient
            .from('courses')
            .select('nom')
            .eq('id', courseId)
            .single();
          
          const courseName = courseData?.nom || courseId;
          
          // Find the first Etape result for the label (prioritize Etape over General)
          const etapeResult = relevantResults.find(r => r.type_classement === 'Etape');
          const gcResult = relevantResults.find(r => r.type_classement === 'General' || r.type_classement === 'GC');
          
          // Format the type label - prefer Etape if available
          let typeLabel: string;
          let typeClassement: string;
          let etapeNumero: number | null = null;
          
          if (etapeResult) {
            etapeNumero = etapeResult.etape_numero;
            typeLabel = etapeNumero ? `Étape ${etapeNumero}` : 'Étape';
            typeClassement = 'Etape';
          } else if (gcResult) {
            typeLabel = 'Classement Général';
            typeClassement = 'General';
          } else {
            continue; // Should not happen given the filter above
          }
          
          console.log(`[admin-import-race-results-csv] Sending ONE push notification for ${courseName} - ${typeLabel}`);
          
          // Call the push notification edge function - ONE per course
          const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({
              broadcast: true,
              title: '🏁 Nouveaux résultats',
              message: `${typeLabel} - ${courseName}`,
              type: 'results_added',
              metadata: {
                course_id: courseId,
                course_name: courseName,
                type_classement: typeClassement,
                etape_numero: etapeNumero
              }
            })
          });
          
          if (!pushResponse.ok) {
            console.error(`[admin-import-race-results-csv] Push notification failed:`, await pushResponse.text());
          } else {
            const pushResult = await pushResponse.json();
            console.log(`[admin-import-race-results-csv] Push notification sent:`, pushResult);
          }
        } catch (pushError) {
          console.error(`[admin-import-race-results-csv] Error sending push notification for ${courseId}:`, pushError);
          // Don't fail the import if push fails
        }
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
