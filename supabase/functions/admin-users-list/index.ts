import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Client utilisateur (JWT) pour vérifier l'accès superadmin et lire les tables publiques
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Vérification superadmin via RPC
    const { data: isSuperAdmin, error: superErr } = await supabaseClient.rpc('is_superadmin');
    if (superErr) {
      console.error('[admin-users-list] is_superadmin RPC error:', superErr);
      throw new Error('Erreur de vérification des permissions');
    }
    if (!isSuperAdmin) {
      throw new Error('Réservé aux super-administrateurs');
    }

    // Vérification de la présence de la clé Service Role
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!SERVICE_ROLE) {
      console.error('[admin-users-list] SERVICE_ROLE_MISSING: SUPABASE_SERVICE_ROLE_KEY non disponible');
      return new Response(
        JSON.stringify({ error: 'SERVICE_ROLE_MISSING: SUPABASE_SERVICE_ROLE_KEY non disponible dans l’environnement de la fonction.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Client admin pour lister les utilisateurs (nécessite Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      SERVICE_ROLE,
    );

    // Récupération paginée de tous les utilisateurs
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000; // large pour minimiser les tours
    try {
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = data?.users ?? [];
        allUsers.push(...users);
        if (users.length < perPage) break; // dernière page
        page += 1;
      }
    } catch (e: any) {
      console.error('[admin-users-list] ADMIN_LIST_USERS_FAILED:', e?.message || e);
      return new Response(
        JSON.stringify({ error: `ADMIN_LIST_USERS_FAILED: ${e?.message || 'Erreur inconnue'}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Récupération des managers
    const { data: managers, error: managersError } = await supabaseClient
      .from('managers')
      .select('id, user_id, nom');
    if (managersError) {
      console.error('[admin-users-list] managers fetch error:', managersError);
      throw managersError;
    }

    // Récupération des rôles users (admin/superadmin stockés dans user_roles)
    const { data: userRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('user_id, role');
    if (rolesError) {
      console.error('[admin-users-list] user_roles fetch error:', rolesError);
      throw rolesError;
    }

    // Récupération des appartenances aux ligues avec rôles et noms
    const { data: leagueMembers, error: leagueError } = await supabaseClient
      .from('league_members')
      .select(`
        user_id, 
        league_id, 
        role_in_league,
        leagues:league_id (
          id,
          name
        )
      `);
    if (leagueError) {
      console.error('[admin-users-list] league_members fetch error:', leagueError);
      throw leagueError;
    }

    // Grouper les ligues par utilisateur avec leurs rôles
    const userLeagues = leagueMembers?.reduce((acc: any, lm: any) => {
      if (!acc[lm.user_id]) acc[lm.user_id] = [];
      acc[lm.user_id].push({
        league_id: lm.league_id,
        league_name: lm.leagues?.name || 'Ligue sans nom',
        role: lm.role_in_league
      });
      return acc;
    }, {});

    // Récupération des stats d'activité pour tous les utilisateurs
    const userActivityStats: Record<string, any> = {};
    for (const user of allUsers) {
      const { data: stats, error: statsError } = await supabaseAdmin.rpc('get_user_activity_stats', {
        target_user_id: user.id
      });
      if (!statsError && stats) {
        userActivityStats[user.id] = stats;
      }
    }

    // Construction du payload
    const users = allUsers.map((user: any) => {
      const manager = managers?.find((m) => m.user_id === user.id);
      const hasSuperAdminRole = userRoles?.some((r) => r.user_id === user.id && r.role === 'superadmin') || false;
      const userLeaguesData = userLeagues?.[user.id] || [];
      const leagueCount = userLeaguesData.length;
      
      // Compter les rôles d'admin de ligue
      const leagueAdminCount = userLeaguesData.filter(
        (l: any) => l.role === 'owner' || l.role === 'admin'
      ).length;

      // Récupérer les stats d'activité
      const activityStats = userActivityStats[user.id] || {
        total_page_views: 0,
        total_sessions: 0,
        pages_today: 0,
        pages_last_7_days: 0,
        pages_last_30_days: 0,
        sessions_today: 0,
        sessions_last_7_days: 0,
        last_page_path: null,
        last_activity_at: null,
        avg_session_duration_seconds: 0
      };

      return {
        user_id: user.id,
        email: user.email || '',
        manager_id: manager?.id || null,
        manager_name: manager?.nom || null,
        is_superadmin: hasSuperAdminRole,
        league_count: leagueCount,
        league_admin_count: leagueAdminCount,
        league_roles: userLeaguesData,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        banned_until: (user as any)?.banned_until || null,
        created_at: user.created_at || null,
        // Nouvelles données d'activité
        activity: activityStats,
      };
    });

    // Tri: superadmins d'abord, puis email
    users.sort((a, b) => {
      if (a.is_superadmin && !b.is_superadmin) return -1;
      if (!a.is_superadmin && b.is_superadmin) return 1;
      return a.email.localeCompare(b.email);
    });

    console.log(`[admin-users-list] OK - users: ${users.length}`);

    return new Response(
      JSON.stringify({ users }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[admin-users-list] ERROR:', error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erreur inconnue' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});