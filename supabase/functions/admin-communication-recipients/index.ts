import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recipient {
  user_id: string;
  email: string;
  manager_name: string | null;
  is_superadmin: boolean;
  is_league_admin: boolean;
  email_confirmed: boolean;
  banned: boolean;
  league_ids: string[];
  league_names: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: isSuperAdmin, error: superErr } = await supabaseClient.rpc('is_superadmin');
    if (superErr) throw new Error('Erreur de vérification des permissions');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Réservé aux super-administrateurs' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: 'SERVICE_ROLE_MISSING' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', SERVICE_ROLE);

    // 1. List all auth users (paginated)
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users ?? [];
      allUsers.push(...users);
      if (users.length < perPage) break;
      page += 1;
    }

    // 2. Managers
    const { data: managers } = await supabaseClient.from('managers').select('user_id, nom');
    const managerByUser = new Map<string, string>();
    (managers ?? []).forEach((m: any) => managerByUser.set(m.user_id, m.nom));

    // 3. Roles
    const { data: userRoles } = await supabaseClient.from('user_roles').select('user_id, role');
    const rolesByUser = new Map<string, Set<string>>();
    (userRoles ?? []).forEach((r: any) => {
      if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
      rolesByUser.get(r.user_id)!.add(r.role);
    });

    // 4. League memberships
    const { data: leagueMembers } = await supabaseClient
      .from('league_members')
      .select('user_id, league_id, role_in_league, leagues:league_id (id, name)');
    const leaguesByUser = new Map<string, { id: string; name: string; role: string }[]>();
    (leagueMembers ?? []).forEach((lm: any) => {
      if (!leaguesByUser.has(lm.user_id)) leaguesByUser.set(lm.user_id, []);
      leaguesByUser.get(lm.user_id)!.push({
        id: lm.league_id,
        name: lm.leagues?.name ?? 'Ligue',
        role: lm.role_in_league,
      });
    });

    // 5. Unsubscribe list
    const { data: unsubs } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('email, used_at');
    const unsubscribed = new Set<string>(
      (unsubs ?? [])
        .filter((u: any) => u.used_at != null)
        .map((u: any) => (u.email as string).toLowerCase())
    );

    const recipients: Recipient[] = allUsers
      .filter((u) => u.email)
      .map((u) => {
        const userLeagues = leaguesByUser.get(u.id) ?? [];
        const roles = rolesByUser.get(u.id) ?? new Set();
        const isLeagueAdmin = userLeagues.some(
          (l) => l.role === 'admin' || l.role === 'owner'
        );
        return {
          user_id: u.id,
          email: u.email,
          manager_name: managerByUser.get(u.id) ?? null,
          is_superadmin: roles.has('admin'),
          is_league_admin: isLeagueAdmin,
          email_confirmed: !!u.email_confirmed_at,
          banned: !!u.banned_until,
          league_ids: userLeagues.map((l) => l.id),
          league_names: userLeagues.map((l) => l.name),
          unsubscribed: unsubscribed.has((u.email as string).toLowerCase()),
        } as Recipient & { unsubscribed: boolean };
      });

    return new Response(JSON.stringify({ recipients }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[admin-communication-recipients] error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erreur inconnue' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
