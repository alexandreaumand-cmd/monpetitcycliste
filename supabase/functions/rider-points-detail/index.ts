import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { coureur_id, phase_id, manager_id = null } = await req.json();

    if (!coureur_id || !phase_id) {
      return new Response(JSON.stringify({ error: 'coureur_id and phase_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get point history for the rider
    let query = supabase
      .from('points_ledger')
      .select(`
        points,
        type_classement,
        etape_numero,
        courses!inner(nom, date_fin)
      `)
      .eq('coureur_id', coureur_id)
      .eq('phase_id', phase_id);

    // If manager_id is provided, filter by manager
    if (manager_id) {
      query = query.eq('manager_id', manager_id);
    }

    const { data: history, error } = await query.order('courses(date_fin)', { ascending: false });

    if (error) throw error;

    // Transform the data to match the expected format
    const transformedHistory = (history || []).map((item: any) => ({
      course_nom: item.courses.nom,
      type_classement: item.type_classement,
      etape_numero: item.etape_numero,
      points: item.points,
      date_classement: item.courses.date_fin
    }));

    // Calculate total points
    const total_points = transformedHistory.reduce((sum: number, item: any) => sum + item.points, 0);

    return new Response(JSON.stringify({ 
      history: transformedHistory,
      total_points
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rider-points-detail:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
