import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { league_id } = await req.json();

    if (!league_id) {
      return new Response(JSON.stringify({ error: 'league_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is a league member
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify league membership
    const { data: membership } = await adminClient
      .from('league_members')
      .select('id')
      .eq('league_id', league_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this league' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all evaluated pronostics for this league
    const { data: pronostics, error: proError } = await adminClient
      .from('arena_pronostics')
      .select('manager_id, is_correct')
      .eq('league_id', league_id)
      .not('is_correct', 'is', null);

    if (proError) throw proError;

    // Aggregate by manager
    const managerStats: Record<string, { correct: number; total: number }> = {};
    for (const p of (pronostics || [])) {
      if (!managerStats[p.manager_id]) {
        managerStats[p.manager_id] = { correct: 0, total: 0 };
      }
      managerStats[p.manager_id].total++;
      if (p.is_correct) managerStats[p.manager_id].correct++;
    }

    // Fetch manager names
    const managerIds = Object.keys(managerStats);
    let managersMap: Record<string, { nom: string; avatar_url: string | null }> = {};

    if (managerIds.length > 0) {
      const { data: managers } = await adminClient
        .from('managers')
        .select('id, nom, avatar_url')
        .in('id', managerIds);

      for (const m of (managers || [])) {
        managersMap[m.id] = { nom: m.nom, avatar_url: m.avatar_url };
      }
    }

    // Build standings
    const standings = managerIds
      .map(id => ({
        manager_id: id,
        manager_nom: managersMap[id]?.nom || 'Inconnu',
        avatar_url: managersMap[id]?.avatar_url || null,
        correct_count: managerStats[id].correct,
        total_count: managerStats[id].total,
      }))
      .sort((a, b) => b.correct_count - a.correct_count || a.total_count - b.total_count);

    return new Response(JSON.stringify({ standings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[standings] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
