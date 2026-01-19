import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { startlist_id, league_id } = await req.json();

    console.log('Fetching manager view for startlist:', startlist_id, 'league:', league_id);

    // Get startlist and race info with phase and saison
    const { data: startlist, error: startlistError } = await supabase
      .from('startlist_imports')
      .select(`
        id,
        race_id,
        route_image_url,
        startlisteur_note,
        courses!inner(
          id,
          nom,
          date_debut,
          phase_id,
          categorie,
          phases!inner(
            id,
            saison_id
          )
        )
      `)
      .eq('id', startlist_id)
      .single();

    if (startlistError || !startlist) {
      throw new Error('Startlist not found');
    }

    // Fetch league-specific notes if league_id is provided
    let leagueNote = null;
    let ratingAuthorName = null;
    
    if (league_id) {
      const { data: leagueNoteData } = await supabase
        .from('league_startlist_notes')
        .select('admin_rating_note, admin_rating_author_id')
        .eq('startlist_id', startlist_id)
        .eq('league_id', league_id)
        .maybeSingle();
      
      if (leagueNoteData?.admin_rating_note) {
        leagueNote = leagueNoteData.admin_rating_note;
        
        if (leagueNoteData.admin_rating_author_id) {
          const { data: managerData } = await supabase
            .from('v_managers_public')
            .select('nom')
            .eq('id', leagueNoteData.admin_rating_author_id)
            .single();
          
          ratingAuthorName = managerData?.nom || null;
        }
      }
    }

    const race = Array.isArray(startlist.courses) ? startlist.courses[0] : startlist.courses;
    const phaseData = Array.isArray(race.phases) ? race.phases[0] : race.phases;
    const phaseId = race.phase_id;
    const saisonId = phaseData.saison_id;

    // Get all matched entries (any status as long as coureur_id is set)
    const { data: entries, error: entriesError } = await supabase
      .from('startlist_entries')
      .select('coureur_id, bib_no')
      .eq('startlist_id', startlist_id)
      .not('coureur_id', 'is', null);

    if (entriesError) throw entriesError;

    // Enrich entries with coureurs_saisons data
    const coureurIds = (entries || []).map(e => e.coureur_id);
    const coureursMap = new Map();

    if (coureurIds.length > 0 && saisonId) {
      for (const coureurId of coureurIds) {
        const { data: csData } = await supabase
          .from('coureurs_saisons')
          .select('coureur_id, coureurs!inner(id, nom), equipe_id, prix_initial')
          .eq('saison_id', saisonId)
          .eq('coureur_id', coureurId)
          .limit(1);

        if (csData && csData.length > 0) {
          const cs = csData[0];
          const coureurInfo = Array.isArray(cs.coureurs) ? cs.coureurs[0] : cs.coureurs;
          let equipeName = '';
          
          if (cs.equipe_id) {
            const { data: equipeData } = await supabase
              .from('equipes_saisons')
              .select('nom_affiche')
              .eq('id', cs.equipe_id)
              .limit(1);
            equipeName = equipeData?.[0]?.nom_affiche || '';
          }
          
          coureursMap.set(coureurId, {
            id: (coureurInfo as any)?.id || cs.coureur_id,
            nom: (coureurInfo as any)?.nom || '',
            equipe: equipeName,
            prix_initial: cs.prix_initial
          });
        }
      }
    }

    // Enrich entries with coureur data
    const enrichedEntries = (entries || []).map(e => ({
      ...e,
      coureurs: coureursMap.get(e.coureur_id) || { id: e.coureur_id, nom: '', equipe: '', prix_initial: 10 }
    }));

    // Get scoring rules for this race category (needed in both modes)
    const { data: scoringRules } = await supabase
      .from('scoring_rules_saisons')
      .select('type_classement, place, points')
      .eq('saison_id', saisonId)
      .eq('categorie', race.categorie)
      .order('type_classement')
      .order('place');

    // Check if we should include managers (only if league_id is provided)
    const includeManagers = !!league_id;

    // If no league_id (SuperAdmin mode), return generic view without managers
    if (!includeManagers) {
      const result = {
        race: {
          id: race.id,
          nom: race.nom,
          date_debut: race.date_debut,
          phase_id: phaseId,
          categorie: race.categorie
        },
        route_image_url: startlist.route_image_url || null,
        startlisteur_note: startlist.startlisteur_note || null,
        admin_rating_note: null,
        admin_rating_author: null,
        managers: [],
        scoring: {
          categorie: race.categorie,
          rules: scoringRules || []
        },
        totals: {
          managers: 0,
          starters_all: enrichedEntries.length
        }
      };

      console.log('SuperAdmin generic view:', result.totals);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get rosters for this phase (without manager join due to RLS restrictions)
    let rostersQuery = supabase
      .from('rosters')
      .select('manager_id, coureur_id')
      .eq('phase_id', phaseId);
    
    // Filter by league_id if provided
    if (league_id) {
      rostersQuery = rostersQuery.eq('league_id', league_id);
    }
    
    const { data: rosters, error: rostersError } = await rostersQuery;

    if (rostersError) throw rostersError;

    console.log(`[startlist-manager-view] Found ${rosters?.length || 0} rosters for phase ${phaseId}, league ${league_id}`);
    console.log(`[startlist-manager-view] enrichedEntries count: ${enrichedEntries.length}`);

    // Fetch managers separately using the public view (bypasses RLS on managers table)
    const managerIds = [...new Set((rosters || []).map(r => r.manager_id))];
    console.log(`[startlist-manager-view] Unique manager IDs: ${managerIds.length}`);
    
    const { data: managersData, error: managersError } = await supabase
      .from('v_managers_public')
      .select('id, nom, sponsor')
      .in('id', managerIds);

    if (managersError) throw managersError;

    console.log(`[startlist-manager-view] Found ${managersData?.length || 0} managers from v_managers_public`);

    // Create a map of manager data
    const managersMap = new Map();
    managersData?.forEach(m => managersMap.set(m.id, m));
    const { data: seasonSponsors } = await supabase
      .from('manager_sponsors')
      .select('manager_id, sponsor, jersey_image_url')
      .eq('saison_id', saisonId)
      .in('manager_id', managerIds);

    // Create a map of manager_id -> season sponsor and jersey
    const seasonSponsorMap = new Map();
    const seasonJerseyMap = new Map();
    seasonSponsors?.forEach(s => {
      seasonSponsorMap.set(s.manager_id, s.sponsor);
      if (s.jersey_image_url) {
        seasonJerseyMap.set(s.manager_id, s.jersey_image_url);
      }
    });

    // Get points from last 5 weeks for each coureur in the startlist
    const pointsCoureurIds = enrichedEntries.map(e => e.coureur_id).filter(Boolean);
    
    // Get all points for coureurs in startlist with course info
    // Points are global - no league_id filter needed (filtering done via coureur_id from startlist entries)
    const { data: allPoints } = await supabase
      .from('points_ledger')
      .select('coureur_id, points, course_id')
      .in('coureur_id', pointsCoureurIds);

    // Get course dates
    const courseIds = [...new Set(allPoints?.map(p => p.course_id) || [])];
    const { data: courseDates } = await supabase
      .from('courses')
      .select('id, date_fin')
      .in('id', courseIds);

    // Build course date map
    const courseDateMap = new Map();
    courseDates?.forEach(c => {
      courseDateMap.set(c.id, c.date_fin);
    });

    // Filter to last 5 weeks and build weekly points map
    const resultsMap = new Map();
    const now = new Date();
    const fiveWeeksAgo = new Date();
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);

    if (allPoints) {
      for (const point of allPoints) {
        const courseDateFin = courseDateMap.get(point.course_id);
        if (!courseDateFin) continue;
        
        const courseDate = new Date(courseDateFin);
        if (courseDate < fiveWeeksAgo) continue; // Skip courses older than 5 weeks
        
        if (!resultsMap.has(point.coureur_id)) {
          resultsMap.set(point.coureur_id, [0, 0, 0, 0, 0]); // 5 weeks
        }
        
        const daysDiff = Math.floor((now.getTime() - courseDate.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.min(Math.floor(daysDiff / 7), 4); // Max 4 (5th week)
        
        resultsMap.get(point.coureur_id)[weekIndex] += point.points;
      }
    }

    // Get phase standings
    let phaseStandingsQuery = supabase
      .from('v_manager_standings_by_phase_v2')
      .select('*')
      .eq('phase_id', phaseId);
    
    if (league_id) {
      phaseStandingsQuery = phaseStandingsQuery.eq('league_id', league_id);
    }
    
    const { data: phaseStandings } = await phaseStandingsQuery
      .order('total_points', { ascending: false });

    // Get total standings
    let totalStandingsQuery = supabase
      .from('v_manager_standings_total_v2')
      .select('*');
    
    if (league_id) {
      totalStandingsQuery = totalStandingsQuery.eq('league_id', league_id);
    }
    
    const { data: totalStandings } = await totalStandingsQuery
      .order('total_points', { ascending: false });

    // Get ratings for managers filtered by league
    const { data: ratings } = await supabase
      .from('startlist_manager_ratings')
      .select('manager_id, stars')
      .eq('startlist_id', startlist_id)
      .eq('league_id', league_id);

    // Calculate average ratings per manager
    const ratingsMap = new Map();
    if (ratings && ratings.length > 0) {
      const grouped = ratings.reduce((acc: any, r: any) => {
        if (!acc[r.manager_id]) acc[r.manager_id] = [];
        acc[r.manager_id].push(r.stars);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([managerId, stars]: [string, any]) => {
        const avg = stars.reduce((sum: number, s: number) => sum + s, 0) / stars.length;
        ratingsMap.set(managerId, { avg_stars: avg, votes: stars.length });
      });
    }

    // Build manager map with standings
    const managerMap = new Map();
    
    for (const roster of rosters || []) {
      const managerData = managersMap.get(roster.manager_id);
      if (!managerData) continue; // Skip if manager not found in public view
      if (!managerMap.has(roster.manager_id)) {
        // Find standings for this manager
        const phaseStanding = phaseStandings?.find(s => s.manager_id === roster.manager_id);
        const totalStanding = totalStandings?.find(s => s.manager_id === roster.manager_id);
        
        // Calculate phase rank
        const phaseRank = phaseStandings ? phaseStandings.findIndex(s => s.manager_id === roster.manager_id) + 1 || null : null;
        const totalRank = totalStandings ? totalStandings.findIndex(s => s.manager_id === roster.manager_id) + 1 || null : null;
        
        // Calculate gaps with adjacent managers in phase standings
        let gap_prev_phase = null;
        let gap_next_phase = null;
        if (phaseRank && phaseStandings) {
          const prevManager = phaseStandings[phaseRank - 2]; // -2 because array is 0-indexed
          const nextManager = phaseStandings[phaseRank]; // Next is at current rank index
          
          if (prevManager) {
            gap_prev_phase = (phaseStanding?.total_points || 0) - (prevManager.total_points || 0);
          }
          if (nextManager) {
            gap_next_phase = (phaseStanding?.total_points || 0) - (nextManager.total_points || 0);
          }
        }
        
        const rating = ratingsMap.get(roster.manager_id);
        // Use season sponsor if available, fallback to global sponsor
        const sponsor = seasonSponsorMap.get(roster.manager_id) || managerData.sponsor;
        const jerseyImageUrl = seasonJerseyMap.get(roster.manager_id) || null;
        
        managerMap.set(roster.manager_id, {
          manager_id: roster.manager_id,
          manager_nom: managerData.nom,
          sponsor: sponsor,
          jersey_image_url: jerseyImageUrl,
          rank_phase: phaseRank,
          rank_total: totalRank,
          points_phase: phaseStanding?.total_points || 0,
          points_total: totalStanding?.total_points || 0,
          gap_prev_phase,
          gap_next_phase,
          avg_stars: rating?.avg_stars || null,
          votes: rating?.votes || 0,
          starters: [],
          starters_count: 0
        });
      }
    }

    // Match entries to managers (ignore riders without roster or without manager in map)
    for (const entry of enrichedEntries) {
      const coureurData = entry.coureurs;
      const roster = (rosters || []).find(r => r.coureur_id === entry.coureur_id);
      if (roster) {
        const manager = managerMap.get(roster.manager_id);
        if (manager) {
          manager.starters.push({
            coureur_id: entry.coureur_id,
            nom: coureurData.nom,
            equipe: coureurData.equipe,
            cote: coureurData.prix_initial,
            bib_no: entry.bib_no,
            recent_results: resultsMap.get(entry.coureur_id) || []
          });
          manager.starters_count++;
        }
      }
      // Riders without roster are not displayed
    }

    // Sort starters by cote (descending) within each manager
    for (const manager of managerMap.values()) {
      manager.starters.sort((a: any, b: any) => (b.cote || 0) - (a.cote || 0));
    }

    const managers = Array.from(managerMap.values())
      .sort((a, b) => {
        // Sort by avg_stars DESC (nulls last), then by starters_count DESC, then by name ASC
        if (a.avg_stars !== null && b.avg_stars !== null) {
          if (a.avg_stars !== b.avg_stars) return b.avg_stars - a.avg_stars;
        } else if (a.avg_stars !== null) {
          return -1; // a has rating, b doesn't, a comes first
        } else if (b.avg_stars !== null) {
          return 1; // b has rating, a doesn't, b comes first
        }
        // If same rating or both null, sort by starters_count
        if (a.starters_count !== b.starters_count) return b.starters_count - a.starters_count;
        // If same starters_count, sort by name
      return a.manager_nom.localeCompare(b.manager_nom);
    });
    
    const result = {
      race: {
        id: race.id,
        nom: race.nom,
        date_debut: race.date_debut,
        phase_id: phaseId,
        categorie: race.categorie
      },
      route_image_url: startlist.route_image_url || null,
      startlisteur_note: startlist.startlisteur_note || null,
      admin_rating_note: leagueNote || null,
      admin_rating_author: ratingAuthorName,
      managers,
      scoring: {
        categorie: race.categorie,
        rules: scoringRules || []
      },
      totals: {
        managers: managers.length,
        starters_all: managers.reduce((sum, m) => sum + m.starters_count, 0)
      }
    };

    console.log('Manager view result:', result.totals);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in startlist-manager-view:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
