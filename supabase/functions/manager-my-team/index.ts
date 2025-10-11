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
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError?.message || 'No user found');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phase_id = null, manager_id = null } = await req.json();

    // Obtenir l'ID du manager (soit fourni, soit celui connecté)
    let targetManagerId = manager_id;
    if (!targetManagerId) {
      const { data: manager, error: managerError } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (managerError || !manager) {
        console.error('Manager not found for user:', user.id, managerError?.message);
        return new Response(JSON.stringify({ error: 'Manager profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetManagerId = manager.id;
    }

    // Utiliser la RPC qui accepte manager_id
    const { data: coureurs, error } = await supabase.rpc('manager_team_by_id', {
      p_manager_id: targetManagerId,
      p_phase_id: phase_id
    });

    if (error) throw error;

    // Calculer les KPIs
    const totalPoints = coureurs?.reduce((sum: number, c: any) => sum + Number(c.points_total || 0), 0) || 0;
    const scorersCount = coureurs?.filter((c: any) => Number(c.points_total || 0) > 0).length || 0;

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

    // Récupérer les points bonus du manager depuis la nouvelle table bonus_points
    let bonusPoints = 0;
    if (phaseId && targetManagerId) {
      const { data: bonusData } = await supabase
        .from('bonus_points')
        .select('points')
        .eq('target_manager_id', targetManagerId)
        .eq('phase_id', phaseId);
      
      if (bonusData && bonusData.length > 0) {
        bonusPoints = bonusData.reduce((sum, bonus) => sum + (bonus.points || 0), 0);
      }
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
          .in('type_classement', ['General', 'Etape'])
          .in('course_id', courseIds);
        
        winsCount = count || 0;
      }
    }

    // Calculer le classement du manager sur la phase
    let myRank = null;
    let managersCount = 0;
    if (phaseId && targetManagerId) {
      const { data: standings } = await supabase
        .from('points_ledger')
        .select('manager_id, points')
        .eq('phase_id', phaseId)
        .not('manager_id', 'is', null);

      if (standings && standings.length > 0) {
        // Agréger les points par manager
        const managerPoints = new Map<string, number>();
        standings.forEach((row: any) => {
          const current = managerPoints.get(row.manager_id) || 0;
          managerPoints.set(row.manager_id, current + row.points);
        });

        // Créer un leaderboard trié
        const leaderboard = Array.from(managerPoints.entries())
          .map(([managerId, points]) => ({ managerId, points }))
          .sort((a, b) => b.points - a.points);

        managersCount = leaderboard.length;
        
        // Trouver la position du manager actuel
        const position = leaderboard.findIndex(m => m.managerId === targetManagerId);
        if (position !== -1) {
          myRank = position + 1;
        }
      }
    }

    return new Response(JSON.stringify({ 
      coureurs: coureurs || [],
      kpis: {
        scorers_count: scorersCount,
        total_points: totalPoints,
        bonus_points: bonusPoints,
        total_with_bonus: totalPoints + bonusPoints,
        wins_count: winsCount,
        my_rank: myRank,
        managers_count: managersCount
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
