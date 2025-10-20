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
    const { name, visibility, settings } = await req.json();

    if (!name || !visibility) {
      return new Response(
        JSON.stringify({ error: 'name and visibility are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['public', 'private'].includes(visibility)) {
      return new Response(
        JSON.stringify({ error: 'visibility must be public or private' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name,
        visibility,
        settings: settings || {},
        owner_manager_id: manager.id,
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
      // Try to cleanup the league
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