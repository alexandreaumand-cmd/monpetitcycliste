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

    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) {
      throw new Error('Accès refusé: réservé aux superadministrateurs');
    }

    const { course_id, course_ids } = await req.json();

    // Handle multiple courses
    if (course_ids && Array.isArray(course_ids)) {
      console.log(`Recalcul des points pour ${course_ids.length} courses:`, course_ids);
      
      const results = [];
      let totalRowsUpserted = 0;
      
      for (const cid of course_ids) {
        try {
          const { data, error } = await supabaseClient.rpc('admin_compute_points_for_course', {
            p_course_id: cid
          });
          
          if (error) {
            console.error(`Erreur pour ${cid}:`, error);
            results.push({ course_id: cid, success: false, error: error.message });
          } else {
            console.log(`✓ ${cid}: ${data.rows_upserted} entrées mises à jour`);
            totalRowsUpserted += data.rows_upserted || 0;
            results.push({ course_id: cid, success: true, rows_upserted: data.rows_upserted });
          }
        } catch (err) {
          console.error(`Exception pour ${cid}:`, err);
          const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
          results.push({ course_id: cid, success: false, error: errorMsg });
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          total_courses: course_ids.length,
          total_rows_upserted: totalRowsUpserted,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle single course
    if (!course_id) {
      throw new Error('course_id ou course_ids est requis');
    }

    console.log(`Recalcul des points pour la course: ${course_id}`);

    const { data, error } = await supabaseClient.rpc('admin_compute_points_for_course', {
      p_course_id: course_id
    });

    if (error) {
      console.error('Erreur lors du recalcul des points:', error);
      throw error;
    }

    console.log('Résultat du recalcul:', data);

    return new Response(
      JSON.stringify({
        success: true,
        ...data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur dans admin-recompute-course:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
