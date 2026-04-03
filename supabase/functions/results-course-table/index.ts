import { createClient } from 'npm:@supabase/supabase-js@2';

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

    const { course_id, type_classement, etape_numero, league_id = null } = await req.json();

    if (!course_id || !type_classement) {
      return new Response(JSON.stringify({ error: 'course_id and type_classement are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to get the current user, but don't block if it fails
    let managerId = null;
    try {
      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('Authorization')?.replace('Bearer ', '') || ''
      );
      
      if (user) {
        const { data: manager } = await supabase
          .from('managers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        managerId = manager?.id || null;
      }
    } catch (e) {
      // If auth fails, continue with null manager_id (public view)
      console.log('No authenticated user, showing public view');
    }

    // Call the database function
    const { data: rows, error } = await supabase.rpc('results_course_table', {
      p_course_id: course_id,
      p_type_classement: type_classement,
      p_etape_numero: etape_numero || null,
      p_manager_id: managerId,
      p_league_id: league_id || null
    });

    if (error) throw error;

    return new Response(JSON.stringify({ rows: rows || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-course-table:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
