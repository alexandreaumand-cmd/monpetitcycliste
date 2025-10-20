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

    // Récupérer UNIQUEMENT les bonus qui NE SONT PAS déjà dans totalPoints
    let bonusPoints = 0;
    let bonusRiderPoints = 0;
    if (phaseId && targetManagerId) {
      // 1. Bonus REÇUS d'autres managers (target_manager_id = manager)
      const { data: receivedBonus } = await supabase
        .from('bonus_points')
        .select('points')
        .eq('target_manager_id', targetManagerId)
        .eq('phase_id', phaseId);
      
      // 2. Bonus du MANAGER (ITT, TTT, First Win, Coureurs, Scoreurs)
      const { data: managerBonus } = await supabase
        .from('manager_bonus_points')
        .select('bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs')
        .eq('manager_id', targetManagerId)
        .eq('phase_id', phaseId)
        .maybeSingle();
      
      // 3. Bonus COUREUR BONUSÉ (pour affichage séparé dans les KPIs)
      //    Ces points sont déjà inclus dans totalPoints (via RPC manager_team_by_id)
      const { data: riderBonus } = await supabase
        .from('bonus_points')
        .select('points')
        .eq('manager_id', targetManagerId)
        .eq('phase_id', phaseId)
        .eq('bonus_type', 'coureur_bonuse');
      
      // Calculer les totaux
      const receivedBonusTotal = receivedBonus?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
      const managerBonusTotal = managerBonus 
        ? (managerBonus.bonus_itt || 0) + 
          (managerBonus.bonus_ttt || 0) + 
          (managerBonus.bonus_first_win || 0) + 
          (managerBonus.bonus_coureurs || 0) + 
          (managerBonus.bonus_scoreurs || 0)
        : 0;
      
      bonusRiderPoints = riderBonus?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
      bonusPoints = receivedBonusTotal + managerBonusTotal; // NE PAS inclure bonusRiderPoints ici
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

    // Calculer le classement du manager sur la phase (depuis la vue officielle)
    let myRank = null;
    let managersCount = 0;
    if (phaseId && targetManagerId) {
      console.log(`[manager-my-team] Computing rank for phase ${phaseId}, manager ${targetManagerId}`);
      
      const { data: standings } = await supabase
        .from('v_manager_standings_by_phase')
        .select('manager_id, total_points')
        .eq('phase_id', phaseId)
        .order('total_points', { ascending: false });

      if (standings && standings.length > 0) {
        managersCount = standings.length;
        
        // Trouver la position du manager actuel
        const position = standings.findIndex(m => m.manager_id === targetManagerId);
        if (position !== -1) {
          myRank = position + 1;
        }
        
        console.log(`[manager-my-team] Phase ${phaseId}: manager ${targetManagerId} rank = ${myRank}/${managersCount}`);
      } else {
        console.log(`[manager-my-team] No standings found for phase ${phaseId}`);
      }
    }

    return new Response(JSON.stringify({ 
      coureurs: coureurs || [],
      kpis: {
        scorers_count: scorersCount,
        total_points: totalPoints,
        bonus_points: bonusPoints,
        bonus_rider_points: bonusRiderPoints,
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
