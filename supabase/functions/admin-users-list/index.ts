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
    // Regular client for verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify superadmin
    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) {
      throw new Error('Réservé aux super-administrateurs');
    }

    // Admin client for listing users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get all users from auth.users with their manager info
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    // Get all managers
    const { data: managers, error: managersError } = await supabaseClient
      .from('managers')
      .select('id, user_id, nom');
    if (managersError) throw managersError;

    // Get user roles
    const { data: userRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'admin');
    if (rolesError) throw rolesError;

    // Get league memberships count
    const { data: leagueCounts, error: leagueError } = await supabaseClient
      .from('league_members')
      .select('user_id, league_id');
    if (leagueError) throw leagueError;

    // Build user data array
    const users = authUsers.users.map(user => {
      const manager = managers?.find(m => m.user_id === user.id);
      const isSuperAdmin = userRoles?.some(r => r.user_id === user.id && r.role === 'admin') || false;
      const leagueCount = leagueCounts?.filter(lc => lc.user_id === user.id).length || 0;
      const userAny = user as any;

      return {
        user_id: user.id,
        email: user.email || '',
        manager_id: manager?.id || null,
        manager_name: manager?.nom || null,
        is_superadmin: isSuperAdmin,
        league_count: leagueCount,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        banned_until: userAny.banned_until || null,
        created_at: user.created_at || null,
      };
    });

    // Sort by superadmin first, then by email
    users.sort((a, b) => {
      if (a.is_superadmin && !b.is_superadmin) return -1;
      if (!a.is_superadmin && b.is_superadmin) return 1;
      return a.email.localeCompare(b.email);
    });

    return new Response(
      JSON.stringify({ users }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
