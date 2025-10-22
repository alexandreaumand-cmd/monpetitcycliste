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

    // Get phases for this season
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id')
      .eq('saison_id', saison_id);

    if (phasesError) throw phasesError;

    const phaseIds = phases.map(p => p.id);

    // Calculate scores for each manager
    const rankings = await Promise.all(
      managers.map(async (manager) => {
        // Get roster with prices
        const { data: roster } = await supabase
          .from('rosters')
          .select('coureur_id, prix_signature')
          .in('phase_id', phaseIds)
          .eq('manager_id', manager.id)
          .eq('league_id', league_id);

        if (!roster || roster.length === 0) {
          return {
            manager_id: manager.id,
            manager_nom: manager.nom,
            rank: 0,
            knowledge_score: 0,
            avg_ratio: 0,
            pepites_count: 0,
            wt_percentage: 0,
          };
        }

        const coureurIds = roster.map(r => r.coureur_id);

        // Get points for these riders (NO filter by manager_id or league_id!)
        const { data: points } = await supabase
          .from('points_ledger')
          .select('coureur_id, points, course_id')
          .in('phase_id', phaseIds)
          .in('coureur_id', coureurIds);

        // Get course categories for WT percentage
        const courseIds = [...new Set((points || []).map(p => p.course_id))];
        const { data: courses } = await supabase
          .from('courses')
          .select('id, wt_tier')
          .in('id', courseIds);

        const courseMap = new Map(courses?.map(c => [c.id, c.wt_tier]) || []);

        // Calculate total points per rider
        const riderPoints = new Map<string, number>();
        let wtPoints = 0;
        let totalPoints = 0;

        (points || []).forEach(p => {
          riderPoints.set(p.coureur_id, (riderPoints.get(p.coureur_id) || 0) + p.points);
          totalPoints += p.points;
          
          const tier = courseMap.get(p.course_id);
          if (tier === 'WT' || tier === 'GT') {
            wtPoints += p.points;
          }
        });

        // Calculate ratios
        const ratios: number[] = [];
        let pepitesCount = 0;

        roster.forEach(r => {
          const pts = riderPoints.get(r.coureur_id) || 0;
          const ratio = pts / (r.prix_signature || 1);
          ratios.push(ratio);

          // Pépite: prix ≤ 20 and ratio > 2.5
          if (r.prix_signature <= 20 && ratio > 2.5) {
            pepitesCount++;
          }
        });

        const avgRatio = ratios.length > 0 
          ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length 
          : 0;

        const wtPercentage = totalPoints > 0 ? (wtPoints / totalPoints) * 100 : 0;

        // Calculate knowledge score (0-100)
        // 50% avg ratio (normalized), 30% pepites, 20% WT percentage
        const normalizedRatio = Math.min(avgRatio * 20, 50); // Max 50 points
        const pepitesScore = Math.min(pepitesCount * 3, 30); // Max 30 points
        const wtScore = Math.min(wtPercentage / 5, 20); // Max 20 points

        const knowledgeScore = Math.round(normalizedRatio + pepitesScore + wtScore);

        return {
          manager_id: manager.id,
          manager_nom: manager.nom,
          rank: 0,
          knowledge_score: knowledgeScore,
          avg_ratio: Math.round(avgRatio * 100) / 100,
          pepites_count: pepitesCount,
          wt_percentage: Math.round(wtPercentage * 10) / 10,
        };
      })
    );

    // Sort by score and assign ranks
    rankings.sort((a, b) => b.knowledge_score - a.knowledge_score);
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    console.log(`Knowledge ranking calculated for ${rankings.length} managers`);

    return new Response(
      JSON.stringify({ rankings }),
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
