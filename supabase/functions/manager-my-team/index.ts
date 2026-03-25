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

    const { phase_id = null, manager_id = null, league_id = null } = await req.json();

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

    // Utiliser la RPC qui accepte manager_id et league_id
    const { data: coureurs, error } = await supabase.rpc('manager_team_by_id', {
      p_manager_id: targetManagerId,
      p_phase_id: phase_id,
      p_league_id: league_id
    });

    if (error) throw error;

    // Récupérer les annonces non publiées pour masquer les coureurs pas encore révélés
    let hiddenRiderIds: string[] = [];
    let pendingAnnouncements = 0;
    
    // Obtenir la phase active ou celle fournie pour les annonces
    let phaseIdForAnnonces = phase_id;
    if (!phaseIdForAnnonces) {
      const { data: activePhase } = await supabase
        .from('phases')
        .select('id')
        .eq('statut', 'active')
        .order('date_debut', { ascending: false })
        .limit(1)
        .single();
      phaseIdForAnnonces = activePhase?.id;
    }
    
    if (phaseIdForAnnonces && league_id) {
      // Récupérer les enchères closes de cette phase/ligue avec des annonces non publiées
      const { data: unpublishedAnnonces } = await supabase
        .from('annonces')
        .select(`
          coureur_id,
          winning_manager_id,
          auction_id
        `)
        .eq('published', false);
      
      if (unpublishedAnnonces && unpublishedAnnonces.length > 0) {
        // Vérifier quelles annonces appartiennent à des enchères de cette phase/ligue
        const auctionIds = [...new Set(unpublishedAnnonces.map(a => a.auction_id))];
        
        const { data: relevantAuctions } = await supabase
          .from('auctions')
          .select('id')
          .in('id', auctionIds)
          .eq('phase_id', phaseIdForAnnonces)
          .eq('league_id', league_id)
          .eq('statut', 'closed');
        
        if (relevantAuctions && relevantAuctions.length > 0) {
          const relevantAuctionIds = new Set(relevantAuctions.map(a => a.id));
          
          // Filtrer les annonces pour ce manager dans ces enchères
          hiddenRiderIds = unpublishedAnnonces
            .filter(a => 
              a.winning_manager_id === targetManagerId && 
              relevantAuctionIds.has(a.auction_id)
            )
            .map(a => a.coureur_id);
          
          pendingAnnouncements = hiddenRiderIds.length;
          
          if (pendingAnnouncements > 0) {
            console.log(`[manager-my-team] Hiding ${pendingAnnouncements} unannounced riders for manager ${targetManagerId}`);
          }
        }
      }
    }
    
    // Filtrer les coureurs pour masquer ceux non annoncés
    const visibleCoureurs = coureurs?.filter((c: any) => !hiddenRiderIds.includes(c.coureur_id)) || [];

    // Calculer les jours de course par coureur
    const raceDaysMap = new Map<string, number>();
    const effectivePhaseId = phase_id || phaseIdForAnnonces;
    if (effectivePhaseId && visibleCoureurs.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Récupérer les courses passées de la phase (filtrées par league scope si applicable)
      let allowedCourseIds: string[] | null = null;
      let leagueStartDate: string | null = null;
      
      if (league_id) {
        // Get allowed course IDs for this league
        const { data: leagueCourses } = await supabase.rpc('get_league_course_ids', { p_league_id: league_id });
        if (leagueCourses) {
          allowedCourseIds = leagueCourses.map((c: any) => c.course_id);
        }
        // Get started_at_effective
        const { data: leagueData } = await supabase
          .from('leagues')
          .select('started_at_effective')
          .eq('id', league_id)
          .single();
        if (leagueData?.started_at_effective) {
          leagueStartDate = leagueData.started_at_effective.split('T')[0];
        }
      }
      
      let coursesQuery = supabase
        .from('courses')
        .select('id, date_debut, date_fin')
        .eq('phase_id', effectivePhaseId)
        .lte('date_debut', today);
      
      const { data: pastCourses } = await coursesQuery;
      
      // Filter courses by league scope
      let filteredCourses = pastCourses || [];
      if (allowedCourseIds) {
        filteredCourses = filteredCourses.filter(c => allowedCourseIds!.includes(c.id));
      }
      if (leagueStartDate) {
        filteredCourses = filteredCourses.filter(c => c.date_debut && c.date_debut >= leagueStartDate!);
      }
      
      if (filteredCourses.length > 0) {
        const courseIds = filteredCourses.map(c => c.id);
        const coureurIds = visibleCoureurs.map((c: any) => c.coureur_id);
        
        // 2. Pour chaque course, trouver le dernier startlist_imports
        const { data: latestImports } = await supabase
          .from('startlist_imports')
          .select('id, race_id, created_at')
          .in('race_id', courseIds)
          .order('created_at', { ascending: false });
        
        if (latestImports && latestImports.length > 0) {
          // Garder seulement le dernier import par race_id
          const latestByRace = new Map<string, string>();
          for (const imp of latestImports) {
            if (!latestByRace.has(imp.race_id)) {
              latestByRace.set(imp.race_id, imp.id);
            }
          }
          const startlistIds = [...latestByRace.values()];
          
          // 3. Récupérer les entrées de startlist pour ces imports et ces coureurs
          const { data: entries } = await supabase
            .from('startlist_entries')
            .select('startlist_id, coureur_id')
            .in('startlist_id', startlistIds)
            .in('coureur_id', coureurIds);
          
          if (entries && entries.length > 0) {
            // Créer un map startlist_id -> race_id
            const startlistToRace = new Map<string, string>();
            for (const [raceId, slId] of latestByRace) {
              startlistToRace.set(slId, raceId);
            }
            
            // Créer un map race_id -> jours
            const raceDaysPerCourse = new Map<string, number>();
            for (const course of filteredCourses) {
            if (course.date_debut && course.date_fin) {
                const debut = new Date(course.date_debut);
                const fin = new Date(course.date_fin);
                const todayDate = new Date(today);
                const effectiveFin = fin <= todayDate ? fin : todayDate;
                const days = Math.round((effectiveFin.getTime() - debut.getTime()) / 86400000) + 1;
                raceDaysPerCourse.set(course.id, days);
              }
            }
            
            // Sommer les jours par coureur
            for (const entry of entries) {
              const raceId = startlistToRace.get(entry.startlist_id);
              if (raceId) {
                const days = raceDaysPerCourse.get(raceId) || 0;
                raceDaysMap.set(entry.coureur_id, (raceDaysMap.get(entry.coureur_id) || 0) + days);
              }
            }
          }
        }
      }
    }
    
    // Attacher race_days à chaque coureur visible
    for (const c of visibleCoureurs) {
      c.race_days = raceDaysMap.get(c.coureur_id) || 0;
    }

    // Calculer les KPIs sur les coureurs VISIBLES uniquement
    const totalPoints = visibleCoureurs.reduce((sum: number, c: any) => sum + Number(c.points_total || 0), 0) || 0;
    // scorersCount sera calculé plus bas via la vue standings (exclut TTT)

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
      let receivedBonusQuery = supabase
        .from('bonus_points')
        .select('points')
        .eq('target_manager_id', targetManagerId)
        .eq('phase_id', phaseId);
      
      if (league_id) receivedBonusQuery = receivedBonusQuery.eq('league_id', league_id);
      const { data: receivedBonus } = await receivedBonusQuery;
      
      // 2. Bonus du MANAGER (ITT, TTT, First Win, Coureurs, Scoreurs)
      let managerBonusQuery = supabase
        .from('manager_bonus_points')
        .select('bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs')
        .eq('manager_id', targetManagerId)
        .eq('phase_id', phaseId);
      
      if (league_id) managerBonusQuery = managerBonusQuery.eq('league_id', league_id);
      const { data: managerBonus } = await managerBonusQuery.maybeSingle();
      
      // 3. Bonus COUREUR BONUSÉ (pour affichage séparé dans les KPIs)
      //    Ces points sont déjà inclus dans totalPoints (via RPC manager_team_by_id)
      let riderBonusQuery = supabase
        .from('bonus_points')
        .select('points')
        .eq('manager_id', targetManagerId)
        .eq('phase_id', phaseId)
        .eq('bonus_type', 'coureur_bonuse');
      
      if (league_id) riderBonusQuery = riderBonusQuery.eq('league_id', league_id);
      const { data: riderBonus } = await riderBonusQuery;
      
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
    if (visibleCoureurs && visibleCoureurs.length > 0 && phaseId) {
      // Extraire les IDs des coureurs visibles du manager
      const coureurIds = visibleCoureurs.map((c: any) => c.coureur_id);
      
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
    let scorersCount = 0;
    if (phaseId && targetManagerId) {
      console.log(`[manager-my-team] Computing rank for phase ${phaseId}, manager ${targetManagerId}`);
      
      let standingsQuery = supabase
        .from('v_manager_standings_by_phase_v2')
        .select('manager_id, total_points, nb_scoreurs')
        .eq('phase_id', phaseId);
      
      if (league_id) standingsQuery = standingsQuery.eq('league_id', league_id);
      const { data: standings } = await standingsQuery.order('total_points', { ascending: false });

      if (standings && standings.length > 0) {
        managersCount = standings.length;
        
        // Trouver la position du manager actuel et récupérer nb_scoreurs
        const position = standings.findIndex(m => m.manager_id === targetManagerId);
        if (position !== -1) {
          myRank = position + 1;
          scorersCount = Number(standings[position].nb_scoreurs) || 0;
        }
        
        console.log(`[manager-my-team] Phase ${phaseId}: manager ${targetManagerId} rank = ${myRank}/${managersCount}, scorers = ${scorersCount}`);
      } else {
        console.log(`[manager-my-team] No standings found for phase ${phaseId}`);
      }
    }

    return new Response(JSON.stringify({ 
      coureurs: visibleCoureurs,
      kpis: {
        scorers_count: scorersCount,
        total_points: totalPoints,
        bonus_points: bonusPoints,
        bonus_rider_points: bonusRiderPoints,
        total_with_bonus: totalPoints + bonusPoints,
        wins_count: winsCount,
        my_rank: myRank,
        managers_count: managersCount,
        pending_announcements: pendingAnnouncements,
        total_race_days: visibleCoureurs.reduce((sum: number, c: any) => sum + (c.race_days || 0), 0)
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
