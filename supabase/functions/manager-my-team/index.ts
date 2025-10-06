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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') || '' },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phase_id = null } = await req.json();

    const { data: coureurs, error } = await supabase.rpc('manager_my_team', {
      p_phase_id: phase_id
    });

    if (error) throw error;

    // Calculer les KPIs
    const totalPoints = coureurs?.reduce((sum: number, c: any) => sum + Number(c.points_total || 0), 0) || 0;
    const scorersCount = coureurs?.filter((c: any) => Number(c.points_total || 0) > 0).length || 0;

    // Obtenir l'ID du manager
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Obtenir la phase active ou celle fournie
    let phaseId = phase_id;
    if (!phaseId) {
      const { data: activePhase } = await supabase
        .from('phases')
        .select('id')
        .eq('statut', 'active')
        .order('date_debut', { ascending: false })
        .limit(1)
        .single();
      phaseId = activePhase?.id;
    }

    // Compter les courses gagnées (1ère position CG ou Etape)
    let winsCount = 0;
    if (coureurs && coureurs.length > 0 && phaseId) {
      // Extraire les IDs des coureurs du manager
      const coureurIds = coureurs.map((c: any) => c.coureur_id);
      
      // Récupérer les IDs des courses de la phase
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('phase_id', phaseId);

      if (courses && courses.length > 0) {
        const courseIds = courses.map(c => c.id);
        
        // Compter les victoires (position 1) des coureurs du manager
        const { count } = await supabase
          .from('race_results')
          .select('*', { count: 'exact', head: true })
          .in('coureur_id', coureurIds)
          .eq('position', 1)
          .in('type_classement', ['CG', 'Etape'])
          .in('course_id', courseIds);
        
        winsCount = count || 0;
      }
    }

    return new Response(JSON.stringify({ 
      coureurs: coureurs || [],
      kpis: {
        scorers_count: scorersCount,
        total_points: totalPoints,
        wins_count: winsCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in manager-my-team:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
