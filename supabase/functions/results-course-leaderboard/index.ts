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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_id } = await req.json();

    if (!course_id) {
      return new Response(JSON.stringify({ error: 'course_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if official points exist in points_ledger
    const { data: pointsLedger, error: ledgerError } = await supabase
      .from('points_ledger')
      .select('manager_id, points, managers(nom)')
      .eq('course_id', course_id);

    if (ledgerError) throw ledgerError;

    let leaders = [];
    let isOfficial = false;

    if (pointsLedger && pointsLedger.length > 0) {
      // Official points exist
      isOfficial = true;
      
      const managerTotals = new Map();
      for (const entry of pointsLedger) {
        const managerId = entry.manager_id;
        const managers = Array.isArray(entry.managers) ? entry.managers[0] : entry.managers;
        const managerNom = managers?.nom;
        const points = entry.points;

        if (!managerTotals.has(managerId)) {
          managerTotals.set(managerId, {
            manager_id: managerId,
            manager_nom: managerNom,
            total_points: 0,
          });
        }

        managerTotals.get(managerId).total_points += points;
      }

      leaders = Array.from(managerTotals.values())
        .sort((a, b) => b.total_points - a.total_points);

    } else {
      // Fallback to theoretical points
      isOfficial = false;

      // Get course details
      const { data: course } = await supabase
        .from('courses')
        .select('categorie, phase_id')
        .eq('id', course_id)
        .single();

      if (!course) {
        return new Response(JSON.stringify({ leaders: [], is_official: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all race results for this course
      const { data: raceResults } = await supabase
        .from('race_results')
        .select(`
          coureur_id,
          position,
          statut,
          type_classement
        `)
        .eq('course_id', course_id)
        .eq('statut', 'finished')
        .not('position', 'is', null);

      if (!raceResults) {
        return new Response(JSON.stringify({ leaders: [], is_official: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const managerTotals = new Map();

      for (const result of raceResults) {
        // Get manager for this rider in this phase
        const { data: roster } = await supabase
          .from('rosters')
          .select('manager_id, managers(nom)')
          .eq('coureur_id', result.coureur_id)
          .eq('phase_id', course.phase_id)
          .single();

        if (!roster) continue;

        const managerId = roster.manager_id;
        const managers = Array.isArray(roster.managers) ? roster.managers[0] : roster.managers;
        const managerNom = managers?.nom;

        // Get theoretical points
        const { data: scoringRule } = await supabase
          .from('scoring_rules')
          .select('points')
          .eq('categorie', course.categorie)
          .eq('type_classement', result.type_classement)
          .eq('place', result.position)
          .single();

        const points = scoringRule?.points || 0;

        if (!managerTotals.has(managerId)) {
          managerTotals.set(managerId, {
            manager_id: managerId,
            manager_nom: managerNom,
            total_points: 0,
          });
        }

        managerTotals.get(managerId).total_points += points;
      }

      leaders = Array.from(managerTotals.values())
        .filter(m => m.total_points > 0)
        .sort((a, b) => b.total_points - a.total_points);
    }

    return new Response(JSON.stringify({ leaders, is_official: isOfficial }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in results-course-leaderboard:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
