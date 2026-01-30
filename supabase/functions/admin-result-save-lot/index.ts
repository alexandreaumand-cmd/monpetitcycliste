import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user context for permission checks
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check superadmin access using user context
    const { data: isSuperAdmin, error: adminError } = await supabaseWithAuth.rpc('is_superadmin');
    if (adminError || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied: superadmin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { p_course_id, p_type_classement, p_etape_numero, p_rows } = await req.json();

    if (!p_course_id || !p_type_classement || !p_rows) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call the database function
    const { data, error } = await supabase.rpc('admin_result_save_lot', {
      p_course_id,
      p_type_classement,
      p_etape_numero,
      p_rows,
    });

    if (error) throw error;

    // Send push notification for relevant result types (Etape or General)
    if (p_type_classement === 'Etape' || p_type_classement === 'General') {
      try {
        // Get course name
        const { data: courseData } = await supabase
          .from('courses')
          .select('nom')
          .eq('id', p_course_id)
          .single();
        
        const courseName = courseData?.nom || p_course_id;
        const typeLabel = p_type_classement === 'Etape' 
          ? (p_etape_numero ? `Étape ${p_etape_numero}` : 'Étape')
          : 'Classement Général';

        console.log(`[admin-result-save-lot] Sending push notification for ${courseName} - ${typeLabel}`);

        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            broadcast: true,
            title: '🏁 Nouveaux résultats',
            message: `${typeLabel} - ${courseName}`,
            type: 'results_added',
            metadata: {
              course_id: p_course_id,
              course_name: courseName,
              type_classement: p_type_classement,
              etape_numero: p_etape_numero
            }
          })
        });

        if (!pushResponse.ok) {
          console.error(`[admin-result-save-lot] Push notification failed:`, await pushResponse.text());
        } else {
          const pushResult = await pushResponse.json();
          console.log(`[admin-result-save-lot] Push notification sent:`, pushResult);
        }
      } catch (pushError) {
        console.error(`[admin-result-save-lot] Error sending push notification:`, pushError);
        // Don't fail the save if push notification fails
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-result-save-lot:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
