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

    const { manager_id, phase_id = null, saison_id = null } = await req.json();

    if (!manager_id) {
      return new Response(
        JSON.stringify({ error: 'manager_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('team-detail params:', { manager_id, phase_id, saison_id });

    // Build scope query
    let scopeQuery = supabaseClient
      .from('points_ledger')
      .select('manager_id, coureur_id, course_id, type_classement, etape_numero, points, created_at, phase_id, courses!inner(nom, date_debut, date_fin), phases!inner(saison_id)')
      .eq('manager_id', manager_id);

    if (phase_id) {
      scopeQuery = scopeQuery.eq('phase_id', phase_id);
    } else if (saison_id) {
      scopeQuery = scopeQuery.eq('phases.saison_id', saison_id);
    }

    const { data: scopeData, error: scopeError } = await scopeQuery;
    if (scopeError) throw scopeError;

    console.log(`Found ${scopeData?.length || 0} points entries for manager`);

    // Aggregate data
    const stats = {
      points_total: 0,
      courses_scored: new Set<string>(),
      rider_points: new Map<string, number>(),
      rider_courses: new Map<string, Set<string>>(),
      rider_last_scored: new Map<string, Date>(),
      rider_breakdown: new Map<string, Array<{
        course_nom: string;
        type_classement: string;
        etape_numero: number | null;
        points: number;
        date_classement: string;
      }>>()
    };

    for (const entry of scopeData || []) {
      stats.points_total += entry.points;
      stats.courses_scored.add(entry.course_id);

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

      // Build breakdown for each rider
      if (!stats.rider_breakdown.has(riderId)) {
        stats.rider_breakdown.set(riderId, []);
      }
      
      const courseInfo = Array.isArray(entry.courses) ? entry.courses[0] : entry.courses;
      stats.rider_breakdown.get(riderId)!.push({
        course_nom: courseInfo?.nom || 'Unknown',
        type_classement: entry.type_classement,
        etape_numero: entry.etape_numero,
        points: entry.points,
        date_classement: courseInfo?.date_fin || courseInfo?.date_debut || entry.created_at
      });
    }

    // Get rider details
    const riderIds = Array.from(stats.rider_points.keys());
    const { data: riders, error: ridersError } = await supabaseClient
      .from('coureurs')
      .select('id, nom, equipe')
      .in('id', riderIds);

    if (ridersError) throw ridersError;

    const riderMap = new Map(riders?.map(r => [r.id, { nom: r.nom, equipe: r.equipe }]) || []);

    // Get manager name
    const { data: manager, error: managerError } = await supabaseClient
      .from('managers')
      .select('nom')
      .eq('id', manager_id)
      .single();

    if (managerError) throw managerError;

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

    // Build scorers with breakdown
    const scorers = Array.from(stats.rider_points.entries())
      .map(([rider_id, points_total]) => {
        const riderInfo = riderMap.get(rider_id);
        const breakdown = stats.rider_breakdown.get(rider_id) || [];
        return {
          rider_id,
          nom: riderInfo?.nom || 'Unknown',
          equipe: riderInfo?.equipe || '',
          points_total,
          nb_courses: stats.rider_courses.get(rider_id)?.size || 0,
          last_scored_at: stats.rider_last_scored.get(rider_id)?.toISOString() || null,
          breakdown: breakdown.sort((a, b) => 
            new Date(b.date_classement).getTime() - new Date(a.date_classement).getTime()
          )
        };
      })
      .filter(s => s.points_total > 0)
      .sort((a, b) => b.points_total - a.points_total);

    const courses_scored = stats.courses_scored.size;
    const avg_per_course = courses_scored > 0 ? stats.points_total / courses_scored : 0;

    return new Response(
      JSON.stringify({
        manager_id,
        manager_nom: manager?.nom || 'Unknown',
        points_total: stats.points_total,
        courses_scored,
        avg_per_course: Math.round(avg_per_course * 10) / 10,
        top_rider,
        scorers,
        scorers_count: scorers.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in team-detail:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
