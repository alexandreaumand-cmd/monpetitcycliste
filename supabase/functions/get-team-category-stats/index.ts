import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { saison_id } = await req.json();
    if (!saison_id) throw new Error('saison_id required');

    // Get phases for the season
    const { data: phases } = await supabase
      .from('phases')
      .select('id, index_dans_saison, statut')
      .eq('saison_id', saison_id)
      .order('index_dans_saison');

    const activePhaseIds = (phases || [])
      .filter((p: any) => p.statut === 'active' || p.statut === 'completed')
      .map((p: any) => p.id);

    if (activePhaseIds.length === 0) {
      return new Response(JSON.stringify({ teams: [], categories: [], phases: phases || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all points for active phases
    const { data: pointsData } = await supabase
      .from('points_ledger')
      .select('coureur_id, phase_id, points')
      .in('phase_id', activePhaseIds);

    // Get coureurs_saisons to map rider -> team + category
    const { data: coureursSaisons } = await supabase
      .from('coureurs_saisons')
      .select('coureur_id, equipe_id')
      .eq('saison_id', saison_id);

    const riderTeamMap = new Map<string, string>();
    (coureursSaisons || []).forEach((cs: any) => riderTeamMap.set(cs.coureur_id, cs.equipe_id));

    // Get equipes_saisons for team names and categories
    const { data: equipesSaisons } = await supabase
      .from('equipes_saisons')
      .select('equipe_id, nom_affiche, categorie')
      .eq('saison_id', saison_id);

    const teamInfoMap = new Map<string, { nom: string; categorie: string }>();
    (equipesSaisons || []).forEach((es: any) => {
      teamInfoMap.set(es.equipe_id, { nom: es.nom_affiche, categorie: es.categorie || 'Unknown' });
    });

    // Get rider names
    const allRiderIds = [...new Set((pointsData || []).map((p: any) => p.coureur_id).filter(Boolean))];
    const { data: ridersData } = await supabase
      .from('coureurs')
      .select('id, nom')
      .in('id', allRiderIds.length > 0 ? allRiderIds : ['__none__']);

    const riderNameMap = new Map<string, string>();
    (ridersData || []).forEach((r: any) => riderNameMap.set(r.id, r.nom));

    // Aggregate points by team and phase, and by rider
    const teamPhasePoints = new Map<string, Map<string, number>>(); // equipe_id -> phase_id -> points
    const teamRiderPoints = new Map<string, Map<string, number>>(); // equipe_id -> coureur_id -> points
    const categoryPhasePoints = new Map<string, Map<string, number>>(); // categorie -> phase_id -> points
    const categoryTotals = new Map<string, number>();

    (pointsData || []).forEach((p: any) => {
      if (!p.coureur_id) return;
      const equipeId = riderTeamMap.get(p.coureur_id);
      if (!equipeId) return;

      const teamInfo = teamInfoMap.get(equipeId);
      const categorie = teamInfo?.categorie || 'Unknown';

      // Team x Phase
      if (!teamPhasePoints.has(equipeId)) teamPhasePoints.set(equipeId, new Map());
      const phaseMap = teamPhasePoints.get(equipeId)!;
      phaseMap.set(p.phase_id, (phaseMap.get(p.phase_id) || 0) + p.points);

      // Team x Rider
      if (!teamRiderPoints.has(equipeId)) teamRiderPoints.set(equipeId, new Map());
      const riderMap = teamRiderPoints.get(equipeId)!;
      riderMap.set(p.coureur_id, (riderMap.get(p.coureur_id) || 0) + p.points);

      // Category x Phase
      if (!categoryPhasePoints.has(categorie)) categoryPhasePoints.set(categorie, new Map());
      const catPhaseMap = categoryPhasePoints.get(categorie)!;
      catPhaseMap.set(p.phase_id, (catPhaseMap.get(p.phase_id) || 0) + p.points);

      // Category total
      categoryTotals.set(categorie, (categoryTotals.get(categorie) || 0) + p.points);
    });

    const totalAllPoints = Array.from(categoryTotals.values()).reduce((a, b) => a + b, 0);

    // Build teams result
    const teams = Array.from(teamPhasePoints.entries()).map(([equipeId, phaseMap]) => {
      const teamInfo = teamInfoMap.get(equipeId) || { nom: 'Unknown', categorie: 'Unknown' };
      const total = Array.from(phaseMap.values()).reduce((a, b) => a + b, 0);

      const phasesBreakdown = activePhaseIds.map((pid: string) => {
        const phase = (phases || []).find((p: any) => p.id === pid);
        return {
          phase_id: pid,
          phase_index: phase?.index_dans_saison || 0,
          points: Math.round(phaseMap.get(pid) || 0),
        };
      });

      const riderMap = teamRiderPoints.get(equipeId) || new Map();
      const riders = Array.from(riderMap.entries())
        .map(([riderId, pts]) => ({
          coureur_id: riderId,
          nom: riderNameMap.get(riderId) || riderId,
          points: Math.round(pts),
        }))
        .sort((a, b) => b.points - a.points);

      return {
        equipe_id: equipeId,
        nom: teamInfo.nom,
        categorie: teamInfo.categorie,
        total: Math.round(total),
        phases: phasesBreakdown,
        riders,
      };
    }).sort((a, b) => b.total - a.total);

    // Build categories result
    const categories = Array.from(categoryTotals.entries()).map(([cat, total]) => {
      const catPhaseMap = categoryPhasePoints.get(cat) || new Map();
      const phasesBreakdown = activePhaseIds.map((pid: string) => {
        const phase = (phases || []).find((p: any) => p.id === pid);
        return {
          phase_id: pid,
          phase_index: phase?.index_dans_saison || 0,
          points: Math.round(catPhaseMap.get(pid) || 0),
        };
      });

      return {
        categorie: cat,
        total: Math.round(total),
        percentage: totalAllPoints > 0 ? Math.round((total / totalAllPoints) * 1000) / 10 : 0,
        phases: phasesBreakdown,
      };
    }).sort((a, b) => b.total - a.total);

    return new Response(JSON.stringify({
      teams,
      categories,
      phases: (phases || []).map((p: any) => ({
        id: p.id,
        index: p.index_dans_saison,
        statut: p.statut,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
