import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  course_id: string;
  type_classement?: 'Etape' | 'General' | 'Points' | 'Montagne' | 'Jeune' | null;
  etape_numero?: number | null;
  league_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { course_id, type_classement, etape_numero, league_id }: RequestBody = await req.json();

    if (!course_id) {
      throw new Error('course_id is required');
    }

    // Fallback to Legacy League if no league_id provided
    const targetLeagueId = league_id || 'f7921741-29f4-4296-9aca-a03c1f3615b0';

    console.log('Getting leaderboard for course:', course_id, { type_classement, etape_numero, targetLeagueId });

    // Get course info with phase_id
    const { data: course, error: courseError } = await supabaseClient
      .from('courses')
      .select('id, nom, date_debut, date_fin, categorie, phase_id')
      .eq('id', course_id)
      .single();

    if (courseError) throw courseError;

    // Build points query - global points (no league filter)
    let pointsQuery = supabaseClient
      .from('points_ledger')
      .select('coureur_id, points, type_classement, etape_numero')
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

    // Get rosters for this phase and league
    const { data: rostersData, error: rostersError } = await supabaseClient
      .from('rosters')
      .select('coureur_id, manager_id')
      .eq('phase_id', course.phase_id)
      .eq('league_id', targetLeagueId);

    if (rostersError) throw rostersError;

    // Create map coureur_id -> manager_id
    const coureurToManager = new Map<string, string>();
    for (const roster of rostersData || []) {
      coureurToManager.set(roster.coureur_id, roster.manager_id);
    }

    // Aggregate by manager
    const managerPoints = new Map<string, number>();
    const contributorsByManager = new Map<string, Array<{
      coureur_id: string;
      type_classement: string;
      etape_numero: number | null;
      points: number;
    }>>();

    for (const point of pointsData || []) {
      const manager_id = coureurToManager.get(point.coureur_id);
      if (!manager_id) continue; // Skip riders not owned in this league

      // Manager totals
      const current = managerPoints.get(manager_id) || 0;
      managerPoints.set(manager_id, current + point.points);

      // Contributors - keep detail for each classification
      if (!contributorsByManager.has(manager_id)) {
        contributorsByManager.set(manager_id, []);
      }
      contributorsByManager.get(manager_id)!.push({
        coureur_id: point.coureur_id,
        type_classement: point.type_classement,
        etape_numero: point.etape_numero,
        points: point.points
      });
    }

    // Get manager names
    const managerIds = Array.from(managerPoints.keys());
    console.log('managerIds count:', managerIds.length);
    
    const { data: managers } = await supabaseClient
      .from('managers')
      .select('id, nom')
      .in('id', managerIds);

    console.log('managers fetched:', managers?.length || 0);
    const managerMap = new Map(managers?.map(m => [m.id, m.nom]) || []);

    // Get rider names and teams
    const riderIds = Array.from(
      new Set(
        Array.from(contributorsByManager.values())
          .flatMap(entries => entries.map(entry => entry.coureur_id))
      )
    );

    console.log('riderIds count:', riderIds.length);

    // Get season ID from phase
    const { data: phaseData } = await supabaseClient
      .from('phases')
      .select('saison_id')
      .eq('id', course.phase_id)
      .single();
    
    const saisonId = phaseData?.saison_id;

    let riders: Array<{ id: string; nom: string; equipe: string }> = [];
    if (riderIds.length > 0 && saisonId) {
      const { data } = await supabaseClient
        .from('coureurs')
        .select(`
          id,
          nom,
          coureurs_saisons!inner(
            equipe_id,
            equipes_saisons!inner(nom_affiche)
          )
        `)
        .eq('coureurs_saisons.saison_id', saisonId)
        .in('id', riderIds);
      
      riders = data?.map((r: any) => ({
        id: r.id,
        nom: r.nom,
        equipe: Array.isArray(r.coureurs_saisons) && r.coureurs_saisons[0]?.equipes_saisons?.nom_affiche || 'N/A'
      })) || [];
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
