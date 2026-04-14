import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is super-admin
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub;

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check super-admin role
    const { data: roleRow } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { league_ids } = await req.json();
    if (!Array.isArray(league_ids) || league_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'league_ids required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch leagues with service role (bypasses RLS)
    const { data: leagues, error: leaguesErr } = await serviceClient
      .from('leagues')
      .select('id, name, owner_manager_id, game_mode, settings')
      .in('id', league_ids);

    if (leaguesErr) throw leaguesErr;

    // Get owner manager details
    const ownerIds = [...new Set((leagues || []).map((l: any) => l.owner_manager_id).filter(Boolean))];
    let managersMap = new Map<string, { nom: string; email: string }>();

    if (ownerIds.length > 0) {
      const { data: managers } = await serviceClient
        .from('managers')
        .select('id, nom, email')
        .in('id', ownerIds);

      if (managers) {
        for (const m of managers) {
          managersMap.set(m.id, { nom: m.nom, email: m.email || '' });
        }
      }
    }

    // Build result map
    const result: Record<string, any> = {};
    for (const l of (leagues || [])) {
      const owner = managersMap.get(l.owner_manager_id) || { nom: 'Inconnu', email: '' };
      result[l.id] = {
        name: l.name,
        game_mode: l.game_mode,
        settings: l.settings,
        owner_name: owner.nom,
        owner_email: owner.email,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[admin-get-leagues-info] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
