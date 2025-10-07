import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const {
      phase_id = null,
      saison_id = null,
      search_manager = null,
      search_rider = null,
      sort = 'points_desc',
      limit = 50,
      offset = 0
    } = await req.json();

    console.log('teams-overview params:', { phase_id, saison_id, search_manager, search_rider, sort, limit, offset });

    // Build scope query for points_ledger
    let scopeQuery = supabaseClient
      .from('points_ledger')
      .select('manager_id, coureur_id, course_id, points, created_at, phase_id, phases!inner(saison_id)');

    if (phase_id) {
      scopeQuery = scopeQuery.eq('phase_id', phase_id);
    } else if (saison_id) {
      scopeQuery = scopeQuery.eq('phases.saison_id', saison_id);
    }

    const { data: scopeData, error: scopeError } = await scopeQuery;
    if (scopeError) throw scopeError;

    console.log(`Found ${scopeData?.length || 0} points_ledger entries in scope`);

    // Aggregate by manager
    const managerStats = new Map<string, {
      points_total: number;
      courses_scored: Set<string>;
      rider_points: Map<string, number>;
      rider_courses: Map<string, Set<string>>;
      rider_last_scored: Map<string, Date>;
      points_30d: number;
    }>();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const entry of scopeData || []) {
      if (!entry.manager_id) continue;

      if (!managerStats.has(entry.manager_id)) {
        managerStats.set(entry.manager_id, {
          points_total: 0,
          courses_scored: new Set(),
          rider_points: new Map(),
          rider_courses: new Map(),
          rider_last_scored: new Map(),
          points_30d: 0,
        });
      }

      const stats = managerStats.get(entry.manager_id)!;
      stats.points_total += entry.points;
      stats.courses_scored.add(entry.course_id);

      // Rider aggregation
      const riderId = entry.coureur_id;
      stats.rider_points.set(riderId, (stats.rider_points.get(riderId) || 0) + entry.points);
      
      if (!stats.rider_courses.has(riderId)) {
        stats.rider_courses.set(riderId, new Set());
      }
      stats.rider_courses.get(riderId)!.add(entry.course_id);

      const entryDate = new Date(entry.created_at);
      const currentLast = stats.rider_last_scored.get(riderId);
      if (!currentLast || entryDate > currentLast) {
        stats.rider_last_scored.set(riderId, entryDate);
      }

      // Points 30d
      if (entryDate >= thirtyDaysAgo) {
        stats.points_30d += entry.points;
      }
    }

    // Get all manager IDs
    const managerIds = Array.from(managerStats.keys());
    console.log(`Found ${managerIds.length} managers with points`);

    // Fetch manager names
    const { data: managers, error: managersError } = await supabaseClient
      .from('managers')
      .select('id, nom')
      .in('id', managerIds);

    if (managersError) throw managersError;

    const managerMap = new Map(managers?.map(m => [m.id, m.nom]) || []);

    // Apply manager search filter
    let filteredManagerIds = managerIds;
    if (search_manager) {
      const searchLower = search_manager.toLowerCase();
      filteredManagerIds = managerIds.filter(id => 
        managerMap.get(id)?.toLowerCase().includes(searchLower)
      );
    }

    // Get all unique rider IDs for filtered managers
    const allRiderIds = new Set<string>();
    for (const managerId of filteredManagerIds) {
      const stats = managerStats.get(managerId)!;
      for (const riderId of stats.rider_points.keys()) {
        allRiderIds.add(riderId);
      }
    }

    // Fetch rider details
    const { data: riders, error: ridersError } = await supabaseClient
      .from('coureurs')
      .select('id, nom, equipe')
      .in('id', Array.from(allRiderIds));

    if (ridersError) throw ridersError;

    const riderMap = new Map(riders?.map(r => [r.id, { nom: r.nom, equipe: r.equipe }]) || []);

    // Apply rider search filter
    if (search_rider) {
      const searchLower = search_rider.toLowerCase();
      filteredManagerIds = filteredManagerIds.filter(managerId => {
        const stats = managerStats.get(managerId)!;
        return Array.from(stats.rider_points.keys()).some(riderId => 
          riderMap.get(riderId)?.nom.toLowerCase().includes(searchLower)
        );
      });
    }

    // Build items array
    const items = filteredManagerIds.map(managerId => {
      const stats = managerStats.get(managerId)!;
      const manager_nom = managerMap.get(managerId) || 'Unknown';

      // Find top rider
      let top_rider = null;
      let maxPoints = 0;
      for (const [riderId, points] of stats.rider_points.entries()) {
        if (points > maxPoints) {
          maxPoints = points;
          const riderInfo = riderMap.get(riderId);
          top_rider = {
            rider_id: riderId,
            nom: riderInfo?.nom || 'Unknown',
            points
          };
        }
      }

      // Build scorers array
      const scorers = Array.from(stats.rider_points.entries())
        .map(([rider_id, points_total]) => {
          const riderInfo = riderMap.get(rider_id);
          return {
            rider_id,
            nom: riderInfo?.nom || 'Unknown',
            equipe: riderInfo?.equipe || '',
            points_total,
            nb_courses: stats.rider_courses.get(rider_id)?.size || 0,
            last_scored_at: stats.rider_last_scored.get(rider_id)?.toISOString() || null
          };
        })
        .filter(s => s.points_total > 0)
        .sort((a, b) => b.points_total - a.points_total);

      const courses_scored = stats.courses_scored.size;
      const avg_per_course = courses_scored > 0 ? stats.points_total / courses_scored : 0;

      return {
        manager_id: managerId,
        manager_nom,
        points_total: stats.points_total,
        points_30d: stats.points_30d,
        courses_scored,
        avg_per_course: Math.round(avg_per_course * 10) / 10,
        top_rider,
        scorers,
        scorers_count: scorers.length
      };
    });

    // Calculate ranks
    const sortedByPoints = [...items].sort((a, b) => b.points_total - a.points_total);
    const itemsWithRank = items.map(item => {
      const rank = sortedByPoints.findIndex(i => i.manager_id === item.manager_id) + 1;
      return { ...item, rank };
    });

    // Apply sorting
    let sortedItems = itemsWithRank;
    switch (sort) {
      case 'points_desc':
        sortedItems.sort((a, b) => b.points_total - a.points_total);
        break;
      case 'rank_asc':
        sortedItems.sort((a, b) => a.rank - b.rank);
        break;
      case 'name_asc':
        sortedItems.sort((a, b) => a.manager_nom.localeCompare(b.manager_nom));
        break;
      case 'points_30_desc':
        sortedItems.sort((a, b) => b.points_30d - a.points_30d);
        break;
      case 'scorers_desc':
        sortedItems.sort((a, b) => b.scorers_count - a.scorers_count);
        break;
    }

    // Pagination
    const paginatedItems = sortedItems.slice(offset, offset + limit);
    const has_more = sortedItems.length > offset + limit;

    return new Response(
      JSON.stringify({
        scope: { phase_id, saison_id },
        totals: {
          managers_count: sortedItems.length,
          items_count: paginatedItems.length
        },
        items: paginatedItems,
        pagination: {
          limit,
          offset,
          has_more
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in teams-overview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
