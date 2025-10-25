import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check superadmin role
    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: réservé aux super-administrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all leagues
    const { data: allLeagues } = await supabaseClient
      .from('leagues')
      .select('id, status, game_mode, created_at, current_player_count, max_players');

    // Total leagues
    const totalLeagues = allLeagues?.length || 0;

    // Leagues by status
    const byStatus = {
      active: allLeagues?.filter(l => l.status === 'active').length || 0,
      pending: allLeagues?.filter(l => l.status === 'pending').length || 0,
      archived: allLeagues?.filter(l => l.status === 'cancelled').length || 0,
      completed: allLeagues?.filter(l => l.status === 'completed').length || 0,
    };

    // Leagues by game mode
    const byGameMode = {
      full_season: allLeagues?.filter(l => l.game_mode === 'full_season').length || 0,
      short_gt: allLeagues?.filter(l => l.game_mode === 'short_gt').length || 0,
      short_wt: allLeagues?.filter(l => l.game_mode === 'short_wt').length || 0,
      short_classics: allLeagues?.filter(l => l.game_mode === 'short_classics').length || 0,
    };

    // Total unique members
    const { count: totalMembers } = await supabaseClient
      .from('league_members')
      .select('user_id', { count: 'exact', head: true });

    // Leagues created this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentLeagues = allLeagues?.filter(l => new Date(l.created_at) > oneWeekAgo).length || 0;

    // Leagues needing attention (empty or no owner)
    const emptyLeagues = allLeagues?.filter(l => l.current_player_count === 0).length || 0;

    // Log action
    const { data: managerData } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (managerData) {
      await supabaseClient.from('audits').insert({
        actor_manager_id: managerData.id,
        action: 'admin_leagues_stats',
        payload_json: JSON.stringify({ totalLeagues, totalMembers }),
      });
    }

    return new Response(
      JSON.stringify({
        total_leagues: totalLeagues,
        total_members: totalMembers || 0,
        by_status: byStatus,
        by_game_mode: byGameMode,
        recent_activity: {
          created_this_week: recentLeagues,
          empty_leagues: emptyLeagues,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in admin-leagues-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
