import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Fetch all rows from a Supabase query using pagination
 * Bypasses the default 1000-row limit
 */
async function fetchAllRows<T>(
  query: any,
  batchSize: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await query.range(from, from + batchSize - 1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

interface RequestBody {
  saison_id?: string | null;
  phase_id?: string | null;
  view_mode?: 'current' | 'phase' | 'season';
  topN?: number | null;
  manager_ids?: string[] | null;
  league_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { view_mode = 'current', phase_id, saison_id, topN = 10, manager_ids, league_id }: RequestBody = await req.json();

    console.log('get-cumulative-points-series called with:', { view_mode, phase_id, saison_id, topN, manager_ids, league_id });

    // Determine date range based on view_mode
    let startDate: Date;
    let endDate: Date = new Date();
    let targetPhaseId: string | null = null;
    let saisonId: string | null = saison_id || null;
    let phaseInfo: any = null;

    if (view_mode === 'phase' && phase_id) {
      // Get phase dates
      const { data: phase } = await supabaseClient
        .from('phases')
        .select('date_debut, date_fin, index_dans_saison')
        .eq('id', phase_id)
        .single();
      
      if (phase) {
        startDate = new Date(phase.date_debut);
        endDate = new Date(phase.date_fin);
        targetPhaseId = phase_id;
        phaseInfo = { index: phase.index_dans_saison, date_debut: phase.date_debut, date_fin: phase.date_fin };
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
    } else if (view_mode === 'season' && saison_id) {
      // Get ONLY phases from the selected season
      const { data: seasonPhases } = await supabaseClient
        .from('phases')
        .select('id, date_debut, date_fin')
        .eq('saison_id', saison_id)
        .order('date_debut', { ascending: true });
      
      if (seasonPhases && seasonPhases.length > 0) {
        // Start from the FIRST phase of THIS season
        startDate = new Date(seasonPhases[0].date_debut);
        // End at the LAST phase of THIS season
        endDate = new Date(seasonPhases[seasonPhases.length - 1].date_fin);
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
    } else {
      // Current mode - get active phase or default to 30 days
      const { data: activePhase } = await supabaseClient
        .from('phases')
        .select('id, date_debut, date_fin, index_dans_saison')
        .eq('statut', 'active')
        .order('date_debut', { ascending: false })
        .limit(1)
        .single();
      
      if (activePhase) {
        startDate = new Date(activePhase.date_debut);
        endDate = new Date(activePhase.date_fin);
        targetPhaseId = activePhase.id;
        phaseInfo = { index: activePhase.index_dans_saison, date_debut: activePhase.date_debut, date_fin: activePhase.date_fin };
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }
    }

    console.log(`Fetching points from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // -------------------------
    // STEP 3: Load rosters to map coureur_id → manager_id
    // -------------------------
    let phaseIdsForRosters: string[] = [];
    if (targetPhaseId) {
      phaseIdsForRosters = [targetPhaseId];
    } else if (view_mode === 'season' && saisonId) {
      const { data: seasonPhases } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saisonId);
      phaseIdsForRosters = seasonPhases?.map(p => p.id) || [];
    }

    let rostersQuery = supabaseClient
      .from('rosters')
      .select('coureur_id, manager_id, phase_id')
      .in('phase_id', phaseIdsForRosters);

    if (league_id) {
      rostersQuery = rostersQuery.eq('league_id', league_id);
    }

    const rosters = await fetchAllRows<any>(rostersQuery);

    console.log(`✅ Loaded ${rosters?.length || 0} rosters for league ${league_id || 'all'} (paginated)`);

    // Build coureur → manager map
    const coureurToManager = new Map<string, string>();
    rosters?.forEach(r => {
      const key = `${r.phase_id}:${r.coureur_id}`;
      coureurToManager.set(key, r.manager_id);
    });

    console.log(`Built coureur→manager map with ${coureurToManager.size} entries`);

    // -------------------------
    // STEP 4: Fetch points data from points_ledger (sans jointure)
    // -------------------------
    let query = supabaseClient
      .from('points_ledger')
      .select('coureur_id, phase_id, points, course_id, type_classement, etape_numero');

    if (targetPhaseId) {
      query = query.eq('phase_id', targetPhaseId);
    }
    
    // For 'season' mode, filter by phase_ids of the selected season
    if (view_mode === 'season' && saison_id) {
      const { data: seasonPhases } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (seasonPhases && seasonPhases.length > 0) {
        const phaseIds = seasonPhases.map(p => p.id);
        query = query.in('phase_id', phaseIds);
      }
    }

    const pointsData = await fetchAllRows<any>(query);

    console.log(`✅ Loaded ${pointsData?.length || 0} points_ledger entries (paginated)`);

    // -------------------------
    // STEP 5: Fetch race_results pour obtenir les dates de classement
    // -------------------------
    // Extraire les course_ids uniques
    const uniqueCourseIds = Array.from(new Set(pointsData?.map(p => p.course_id) || []));
    
    console.log(`Fetching race_results for ${uniqueCourseIds.length} courses`);

    // Récupérer TOUS les race_results de ces courses
    const raceDatesQuery = supabaseClient
      .from('race_results')
      .select('course_id, type_classement, etape_numero, coureur_id, date_classement')
      .in('course_id', uniqueCourseIds);

    const raceDates = await fetchAllRows<any>(raceDatesQuery);

    console.log(`✅ Fetched ${raceDates?.length || 0} race_results entries (paginated)`);

    // Créer un index pour lookup rapide: course_id:type:etape:coureur → date_classement
    const dateIndex = new Map<string, string>();
    raceDates?.forEach(rr => {
      const key = `${rr.course_id}:${rr.type_classement}:${rr.etape_numero || 'null'}:${rr.coureur_id}`;
      dateIndex.set(key, rr.date_classement);
    });

    console.log(`Built date index with ${dateIndex.size} entries from ${raceDates?.length || 0} race_results`);

    // Determine actual date range from classification dates
    let actualStartDate: Date | null = null;
    let actualEndDate: Date | null = null;

    Array.from(dateIndex.values()).forEach((dateStr: string) => {
      const date = new Date(dateStr);
      if (!actualStartDate || date < actualStartDate) actualStartDate = date;
      if (!actualEndDate || date > actualEndDate) actualEndDate = date;
    });

    // Use actual course dates for the graph range
    if (actualStartDate) startDate = actualStartDate;
    if (actualEndDate) endDate = actualEndDate;

    console.log(`Actual date range from courses: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Aggregate points by manager and date using rosters map and dateIndex
    const pointsByManagerAndDate = new Map<string, Map<string, { points: number }>>();
    const managerIds = new Set<string>();

    let pointsAggregated = 0;
    let pointsSkipped = 0;

    pointsData?.forEach((row: any) => {
      // Récupérer la date depuis l'index
      const key = `${row.course_id}:${row.type_classement}:${row.etape_numero || 'null'}:${row.coureur_id}`;
      const classementDate = dateIndex.get(key);
      
      if (!classementDate) {
        pointsSkipped++;
        return;
      }
      
      const date = new Date(classementDate).toISOString().split('T')[0];
      
      // Get manager via rosters map
      const rosterKey = `${row.phase_id}:${row.coureur_id}`;
      const managerId = coureurToManager.get(rosterKey);
      
      if (!managerId) {
        pointsSkipped++;
        return; // Coureur not owned in this league/phase
      }
      
      pointsAggregated++;
      managerIds.add(managerId);
      
      if (!pointsByManagerAndDate.has(managerId)) {
        pointsByManagerAndDate.set(managerId, new Map());
      }
      
      const dateMap = pointsByManagerAndDate.get(managerId)!;
      const existing = dateMap.get(date) || { points: 0 };
      existing.points += row.points;
      dateMap.set(date, existing);
    });

    console.log(`Points aggregated: ${pointsAggregated}, skipped (no manager/date): ${pointsSkipped}`);
    console.log(`Total managers with points: ${managerIds.size}`);
    console.log(`Total managers with points: ${managerIds.size}`);

    // Load manager names separately
    const managersQuery = supabaseClient
      .from('managers')
      .select('id, nom')
      .in('id', Array.from(managerIds));

    const managersData = await fetchAllRows<any>(managersQuery);

    console.log(`✅ Loaded ${managersData?.length || 0} managers (paginated)`);

    const managerNames = new Map<string, string>();
    managersData?.forEach(m => {
      managerNames.set(m.id, m.nom);
    });

    // Get manager bonus points - récupérer tous les bonus si pas de targetPhaseId (mode season)
    let bonusManagerQuery = supabaseClient
      .from('manager_bonus_points')
      .select(`
        manager_id,
        phase_id,
        bonus_itt,
        bonus_ttt,
        bonus_first_win,
        bonus_coureurs,
        bonus_scoreurs,
        phases!inner(date_fin, saison_id)
      `);
    
    if (league_id) {
      bonusManagerQuery = bonusManagerQuery.eq('league_id', league_id);
    }

    // En mode phase, on filtre par phase_id
    // En mode season, on récupère tous et on filtre par date après
    if (targetPhaseId) {
      bonusManagerQuery = bonusManagerQuery.eq('phase_id', targetPhaseId);
    } else if (view_mode === 'season' && saison_id) {
      bonusManagerQuery = bonusManagerQuery.eq('phases.saison_id', saison_id);
    }

    const bonusManagerData = await fetchAllRows<any>(bonusManagerQuery);

    console.log(`✅ Loaded ${bonusManagerData?.length || 0} manager bonus entries (paginated)`);

    // Get rider bonus points - récupérer tous les bonus si pas de targetPhaseId (mode season)
    let bonusRiderQuery = supabaseClient
      .from('bonus_points')
      .select(`
        manager_id,
        target_manager_id,
        phase_id,
        points,
        phases!inner(date_fin, saison_id)
      `);
    
    if (league_id) {
      bonusRiderQuery = bonusRiderQuery.eq('league_id', league_id);
    }

    // En mode phase, on filtre par phase_id
    // En mode season, on récupère tous et on filtre par date après
    if (targetPhaseId) {
      bonusRiderQuery = bonusRiderQuery.eq('phase_id', targetPhaseId);
    } else if (view_mode === 'season' && saison_id) {
      bonusRiderQuery = bonusRiderQuery.eq('phases.saison_id', saison_id);
    }

    const bonusRiderData = await fetchAllRows<any>(bonusRiderQuery);

    console.log(`✅ Loaded ${bonusRiderData?.length || 0} rider bonus entries (paginated)`);

    // Add manager bonus points (aggregated at phase end date)
    bonusManagerData?.forEach((row: any) => {
      const phaseEndDate = row.phases?.date_fin;
      if (!phaseEndDate) return;
      
      const date = new Date(phaseEndDate).toISOString().split('T')[0];
      
      // NO DATE FILTERING for bonus points either
      
      const managerId = row.manager_id;
      const totalBonus = (row.bonus_itt || 0) + (row.bonus_ttt || 0) + 
                         (row.bonus_first_win || 0) + (row.bonus_coureurs || 0) + 
                         (row.bonus_scoreurs || 0);
      
      if (totalBonus === 0) return;
      
      if (!pointsByManagerAndDate.has(managerId)) {
        pointsByManagerAndDate.set(managerId, new Map());
      }
      
      const dateMap = pointsByManagerAndDate.get(managerId)!;
      const existing = dateMap.get(date) || { points: 0 };
      existing.points += totalBonus;
      dateMap.set(date, existing);
    });

    // Add rider bonus points (aggregated at phase end date)
    bonusRiderData?.forEach((row: any) => {
      const phaseEndDate = row.phases?.date_fin;
      if (!phaseEndDate) return;
      
      const date = new Date(phaseEndDate).toISOString().split('T')[0];
      
      // NO DATE FILTERING for bonus points either
      
      const managerId = row.target_manager_id || row.manager_id;
      if (!managerId) return;
      
      const bonusPoints = row.points || 0;
      if (bonusPoints === 0) return;
      
      if (!pointsByManagerAndDate.has(managerId)) {
        pointsByManagerAndDate.set(managerId, new Map());
      }
      
      const dateMap = pointsByManagerAndDate.get(managerId)!;
      const existing = dateMap.get(date) || { points: 0 };
      existing.points += bonusPoints;
      dateMap.set(date, existing);
    });

    // Determine which managers to display
    let selectedManagers: string[] = [];
    
    if (manager_ids && manager_ids.length > 0) {
      selectedManagers = manager_ids;
    } else {
      // Get top N managers by total points in period
      const managerTotals = Array.from(pointsByManagerAndDate.entries()).map(([managerId, dateMap]) => {
        const total = Array.from(dateMap.values()).reduce((sum, d) => sum + d.points, 0);
        return { managerId, total };
      });
      
      managerTotals.sort((a, b) => b.total - a.total);
      selectedManagers = managerTotals.slice(0, topN || 5).map(m => m.managerId);
    }

    // Generate all dates in range
    const allDates: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      allDates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Build cumulative series for each selected manager
    const series = selectedManagers.map(managerId => {
      const dateMap = pointsByManagerAndDate.get(managerId) || new Map();
      const managerNom = managerNames.get(managerId) || 'Unknown';
      
      let cumulative = 0;
      const points = allDates.map(date => {
        const dailyData = dateMap.get(date);
        cumulative += dailyData?.points || 0;
        return {
          date,
          value: cumulative
        };
      });

      return {
        manager_id: managerId,
        manager_nom: managerNom,
        points
      };
    });

    const response = {
      meta: {
        view_mode,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        phase_info: phaseInfo,
        managers: selectedManagers.map(id => ({
          id,
          nom: managerNames.get(id)
        })).filter(m => m.nom && m.nom !== 'Unknown')
      },
      series: series.filter(s => s.manager_nom && s.manager_nom !== 'Unknown')
    };

    console.log('Returning cumulative series:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-cumulative-points-series:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
