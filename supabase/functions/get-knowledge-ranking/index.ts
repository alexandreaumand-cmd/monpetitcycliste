import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PAGE_SIZE = 1000;

async function fetchAllRows(
  queryFn: (offset: number) => Promise<{ data: any[] | null; error: any }>
): Promise<any[]> {
  let all: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await queryFn(offset);
    if (error) throw error;
    if (data && data.length > 0) {
      all = all.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { saison_id, league_id } = await req.json();

    console.log('Calculating knowledge ranking for saison:', saison_id);

    // Fetch managers filtered by league
    let managersQuery = supabase
      .from('managers')
      .select('id, nom, user_id');

    if (league_id) {
      const { data: leagueManagers, error: leagueMembersError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', league_id);

      if (leagueMembersError) throw leagueMembersError;

      const userIds = leagueManagers?.map(lm => lm.user_id) || [];
      managersQuery = managersQuery.in('user_id', userIds);
    }

    const { data: managers, error: managersError } = await managersQuery;
    if (managersError) throw managersError;

    // Get phases for this season (with numero for labeling)
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id, numero')
      .eq('saison_id', saison_id)
      .order('numero', { ascending: true });

    if (phasesError) throw phasesError;

    const phaseIds = phases.map(p => p.id);
    const phaseLabels = phases.map(p => `P${p.numero}`);
    const phaseIdToIndex = new Map(phases.map((p, i) => [p.id, i]));

    // Fetch all coureurs names in one go
    const { data: allCoureurs, error: coureursError } = await supabase
      .from('coureurs')
      .select('id, nom');
    if (coureursError) throw coureursError;
    const coureurNameMap = new Map((allCoureurs || []).map(c => [c.id, c.nom]));

    // Calculate scores for each manager
    const rankings = await Promise.all(
      managers.map(async (manager) => {
        // Get roster with prices and phase_id (paginated)
        const roster = await fetchAllRows((offset) =>
          supabase
            .from('rosters')
            .select('coureur_id, prix_signature, phase_id')
            .in('phase_id', phaseIds)
            .eq('manager_id', manager.id)
            .eq('league_id', league_id)
            .range(offset, offset + PAGE_SIZE - 1)
        );

        if (!roster || roster.length === 0) {
          return {
            manager_id: manager.id,
            manager_nom: manager.nom,
            rank: 0,
            knowledge_score: 0,
            avg_ratio: 0,
            pepites_count: 0,
            wt_percentage: 0,
            riders: [],
          };
        }

        // Track which phases each rider belongs to
        const riderPhases = new Map<string, Set<string>>();
        roster.forEach(r => {
          if (!riderPhases.has(r.coureur_id)) riderPhases.set(r.coureur_id, new Set());
          riderPhases.get(r.coureur_id)!.add(r.phase_id);
        });

        const coureurIds = [...new Set(roster.map(r => r.coureur_id))];

        // Get points for these riders WITH phase_id (paginated)
        const points = await fetchAllRows((offset) =>
          supabase
            .from('points_ledger')
            .select('coureur_id, points, course_id, phase_id')
            .in('phase_id', phaseIds)
            .in('coureur_id', coureurIds)
            .range(offset, offset + PAGE_SIZE - 1)
        );

        // Get course categories for WT percentage
        const courseIds = [...new Set((points || []).map(p => p.course_id))];
        const { data: courses } = await supabase
          .from('courses')
          .select('id, wt_tier')
          .in('id', courseIds);

        const courseMap = new Map(courses?.map(c => [c.id, c.wt_tier]) || []);

        // Calculate total points per rider AND per rider+phase
        const riderPoints = new Map<string, number>();
        const riderPhasePoints = new Map<string, number[]>(); // coureur_id -> points per phase index
        let wtPoints = 0;
        let totalPoints = 0;

        (points || []).forEach(p => {
          // Only count points for phases where this rider is in the roster
          const riderPhaseSet = riderPhases.get(p.coureur_id);
          if (!riderPhaseSet || !riderPhaseSet.has(p.phase_id)) return;

          riderPoints.set(p.coureur_id, (riderPoints.get(p.coureur_id) || 0) + p.points);
          totalPoints += p.points;

          const tier = courseMap.get(p.course_id);
          if (tier === 'WT' || tier === 'GT') {
            wtPoints += p.points;
          }

          // Track per-phase points
          if (!riderPhasePoints.has(p.coureur_id)) {
            riderPhasePoints.set(p.coureur_id, new Array(phases.length).fill(0));
          }
          const phaseIdx = phaseIdToIndex.get(p.phase_id);
          if (phaseIdx !== undefined) {
            riderPhasePoints.get(p.coureur_id)![phaseIdx] += p.points;
          }
        });

        // Deduplicate roster by coureur_id (keep highest prix_signature)
        const rosterMap = new Map<string, number>();
        roster.forEach(r => {
          const existing = rosterMap.get(r.coureur_id) || 0;
          if (r.prix_signature > existing) {
            rosterMap.set(r.coureur_id, r.prix_signature);
          }
        });

        // Build riders array and calculate ratios
        const ratios: number[] = [];
        let pepitesCount = 0;
        const riders: any[] = [];

        rosterMap.forEach((prix, coureurId) => {
          const pts = riderPoints.get(coureurId) || 0;
          const ratio = pts / (prix || 1);
          const roundedRatio = Math.round(ratio * 100) / 100;
          ratios.push(ratio);

          const isPepite = prix <= 20 && ratio > 2.5;
          if (isPepite) pepitesCount++;

          const phasePointsArr = riderPhasePoints.get(coureurId) || new Array(phases.length).fill(0);
          // Determine which phases this rider was active in
          const riderActivePhases = riderPhases.get(coureurId) || new Set();
          const phases_active = phases.map(p => riderActivePhases.has(p.id));

          riders.push({
            nom: coureurNameMap.get(coureurId) || coureurId,
            prix_signature: prix,
            points: Math.round(pts),
            ratio: roundedRatio,
            is_pepite: isPepite,
            phase_points: phasePointsArr.map(v => Math.round(v)),
            phases_active,
          });
        });

        // Sort riders: pépites first, then by ratio desc
        riders.sort((a, b) => {
          if (a.is_pepite !== b.is_pepite) return a.is_pepite ? -1 : 1;
          return b.ratio - a.ratio;
        });

        const avgRatio = ratios.length > 0
          ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length
          : 0;

        const wtPercentage = totalPoints > 0 ? (wtPoints / totalPoints) * 100 : 0;

        const normalizedRatio = Math.min(avgRatio * 20, 50);
        const pepitesScore = Math.min(pepitesCount * 3, 30);
        const wtScore = Math.min(wtPercentage / 5, 20);

        const knowledgeScore = Math.round(normalizedRatio + pepitesScore + wtScore);

        return {
          manager_id: manager.id,
          manager_nom: manager.nom,
          rank: 0,
          knowledge_score: knowledgeScore,
          avg_ratio: Math.round(avgRatio * 100) / 100,
          pepites_count: pepitesCount,
          wt_percentage: Math.round(wtPercentage * 10) / 10,
          riders,
        };
      })
    );

    rankings.sort((a, b) => b.knowledge_score - a.knowledge_score);
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    console.log(`Knowledge ranking calculated for ${rankings.length} managers`);

    return new Response(
      JSON.stringify({ rankings, phase_labels: phaseLabels }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-knowledge-ranking:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
