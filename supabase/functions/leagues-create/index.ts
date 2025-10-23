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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get manager for this user
    const { data: manager, error: managerError } = await supabase
      .from('managers')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single();

    if (managerError || !manager) {
      return new Response(
        JSON.stringify({ error: 'Manager not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const {
      name,
      visibility,
      gameMode,
      maxPlayers,
      bonusesEnabled,
      budget,
      maxRiders,
      scopeConfig,
    } = await req.json();

    // Validate inputs
    if (!name || name.length < 3) {
      return new Response(
        JSON.stringify({ error: 'League name must be at least 3 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['public', 'private'].includes(visibility)) {
      return new Response(
        JSON.stringify({ error: 'Invalid visibility' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['full_season', 'short_gt', 'short_wt', 'short_classics'].includes(gameMode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid game mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (![4, 6, 8, 10].includes(maxPlayers)) {
      return new Response(
        JSON.stringify({ error: 'Invalid player count' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!scopeConfig?.seasonId) {
      return new Response(
        JSON.stringify({ error: 'Season ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name,
        visibility,
        owner_manager_id: manager.id,
        game_mode: gameMode,
        max_players: maxPlayers,
        current_player_count: 0,
        bonuses_enabled: bonusesEnabled,
        status: 'pending',
        settings: {
          budget,
          max_riders: maxRiders,
        },
      })
      .select()
      .single();

    if (leagueError) {
      console.error('Error creating league:', leagueError);
      return new Response(
        JSON.stringify({ error: leagueError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create league scope
    const { error: scopeError } = await supabase
      .from('league_scopes')
      .insert({
        league_id: league.id,
        season_id: scopeConfig.seasonId,
        by_phase: scopeConfig.byPhase,
        gt_only: scopeConfig.gtOnly,
        wt_only: scopeConfig.wtOnly,
        phases: scopeConfig.phases,
        competitions: scopeConfig.competitions,
      });

    if (scopeError) {
      console.error('Error creating league scope:', scopeError);
      // Rollback league creation
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create league scope' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add creator as owner member
    const { error: memberError } = await supabase
      .from('league_members')
      .insert({
        league_id: league.id,
        user_id: user.id,
        role_in_league: 'owner',
      });

    if (memberError) {
      console.error('Error adding league member:', memberError);
      // Rollback
      await supabase.from('league_scopes').delete().eq('league_id', league.id);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(
        JSON.stringify({ error: 'Failed to add owner as member' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('League created:', league.id, 'by user:', user.id);

    return new Response(
      JSON.stringify({ league }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in leagues-create:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});