import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  course_id: string;
  type_classement?: 'Etape' | 'General' | 'Points' | 'Montagne' | 'Jeune' | null;
  etape_numero?: number | null;
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
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { course_id, type_classement, etape_numero }: RequestBody = await req.json();

    if (!course_id) {
      throw new Error('course_id is required');
    }

    console.log('Getting leaderboard for course:', course_id, { type_classement, etape_numero });

    // Get course info with phase_id
    const { data: course, error: courseError } = await supabaseClient
      .from('courses')
      .select('id, nom, date_debut, date_fin, categorie, phase_id')
      .eq('id', course_id)
      .single();

    if (courseError) throw courseError;

    // Build points query - filter by phase_id to ensure season-specific data
    let pointsQuery = supabaseClient
      .from('points_ledger')
      .select('manager_id, coureur_id, points, type_classement, etape_numero')
      .eq('course_id', course_id)
      .eq('phase_id', course.phase_id);

    if (type_classement) {
      pointsQuery = pointsQuery.eq('type_classement', type_classement);
      if (type_classement === 'Etape' && etape_numero) {
        pointsQuery = pointsQuery.eq('etape_numero', etape_numero);
      }
    }

    const { data: pointsData, error: pointsError } = await pointsQuery;

    if (pointsError) throw pointsError;

    // Aggregate by manager
    const managerPoints = new Map<string, number>();
    const contributorsByManager = new Map<string, Array<{
      coureur_id: string;
      type_classement: string;
      etape_numero: number | null;
      points: number;
    }>>();

    for (const point of pointsData || []) {
      // Manager totals
      const current = managerPoints.get(point.manager_id) || 0;
      managerPoints.set(point.manager_id, current + point.points);

      // Contributors - keep detail for each classification
      if (!contributorsByManager.has(point.manager_id)) {
        contributorsByManager.set(point.manager_id, []);
      }
      contributorsByManager.get(point.manager_id)!.push({
        coureur_id: point.coureur_id,
        type_classement: point.type_classement,
        etape_numero: point.etape_numero,
        points: point.points
      });
    }

    // Get manager names
    const managerIds = Array.from(managerPoints.keys());
    const { data: managers } = await supabaseClient
      .from('managers')
      .select('id, nom')
      .in('id', managerIds);

    const managerMap = new Map(managers?.map(m => [m.id, m.nom]) || []);

    // Get rider names
    const riderIds = Array.from(
      new Set(
        Array.from(contributorsByManager.values())
          .flatMap(entries => entries.map(entry => entry.coureur_id))
      )
    );

    console.log('riderIds count:', riderIds.length);

    let riders: Array<{ id: string; nom: string; equipe: string | null }> = [];
    if (riderIds.length > 0) {
      const { data } = await supabaseClient
        .from('coureurs')
        .select('id, nom, equipe')
        .in('id', riderIds);
      riders = data || [];
    }

    const riderMap = new Map(riders.map(r => [r.id, { nom: r.nom, equipe: r.equipe }]) || []);

    // Build leaderboard
    const leaderboard = Array.from(managerPoints.entries())
      .map(([manager_id, points]) => ({
        manager_id,
        manager_nom: managerMap.get(manager_id) || 'Unknown',
        points
      }))
      .sort((a, b) => b.points - a.points)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));

    // Build contributors list
    const contributors = [];
    for (const [manager_id, entries] of contributorsByManager.entries()) {
      for (const entry of entries) {
        const riderInfo = riderMap.get(entry.coureur_id);
        contributors.push({
          manager_id,
          rider_id: entry.coureur_id,
          rider_nom: riderInfo?.nom || 'Unknown',
          type_classement: entry.type_classement,
          etape_numero: entry.etape_numero,
          points: entry.points
        });
      }
    }

    return new Response(
      JSON.stringify({
        course: {
          id: course.id,
          nom: course.nom,
          date_debut: course.date_debut,
          date_fin: course.date_fin,
          category: course.categorie
        },
        leaderboard,
        contributors
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in course-leaderboard:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
