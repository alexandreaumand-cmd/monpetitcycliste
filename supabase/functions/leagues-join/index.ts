import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyLeagueMembers } from '../_shared/notifications.ts';

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

    // Parse request body
    const { league_id } = await req.json();

    if (!league_id) {
      return new Response(
        JSON.stringify({ error: 'league_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if league exists and is public
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', league_id)
      .single();

    if (leagueError || !league) {
      return new Response(
        JSON.stringify({ error: 'League not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (league.visibility !== 'public') {
      return new Response(
        JSON.stringify({ error: 'Cette ligue est privée. Demandez une invitation à un administrateur.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('league_members')
      .select('id')
      .eq('league_id', league_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: 'Vous êtes déjà membre de cette ligue' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add user as member
    const { error: memberError } = await supabase
      .from('league_members')
      .insert({
        league_id,
        user_id: user.id,
        role_in_league: 'member',
      });

    if (memberError) {
      console.error('Error adding league member:', memberError);
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User', user.id, 'joined league:', league_id);

    // Re-fetch league to get updated current_player_count
    const { data: updatedLeague } = await supabase
      .from('leagues')
      .select('name, visibility, settings, max_players, current_player_count, status')
      .eq('id', league_id)
      .single();

    // Check if this was the last player → open auction if deadline passed
    if (updatedLeague && updatedLeague.current_player_count >= updatedLeague.max_players) {
      console.log('[JOIN] League is now full! Checking for scheduled auctions...');
      
      const { data: scheduledAuctions } = await supabase
        .from('auctions')
        .select('id, opens_at, deadline_at, round_number')
        .eq('league_id', league_id)
        .eq('statut', 'scheduled')
        .order('round_number', { ascending: true })
        .limit(1);

      if (scheduledAuctions && scheduledAuctions.length > 0) {
        const auction = scheduledAuctions[0];
        const opensAt = new Date(auction.opens_at);
        const now = new Date();

        if (opensAt <= now) {
          const newDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
          
          const { error: openError } = await supabase
            .from('auctions')
            .update({ statut: 'open', deadline_at: newDeadline })
            .eq('id', auction.id)
            .eq('statut', 'scheduled');

          if (!openError) {
            console.log(`[JOIN] ✅ Opened auction ${auction.id} immediately (deadline had passed)`);
            // Send notification to all league members
            try {
              await notifyLeagueMembers(supabase, league_id, {
                type: 'auction_opened',
                title: '🔔 Enchères ouvertes !',
                message: `Le Round ${auction.round_number} des enchères est ouvert dans ${updatedLeague?.name || 'votre ligue'} ! Vous avez 24h pour placer vos mises.`,
                metadata: {
                  league_id: league_id,
                  league_name: updatedLeague?.name || 'votre ligue',
                  auction_id: auction.id,
                  round_number: auction.round_number,
                },
              });
            } catch (notifErr) {
              console.error('[JOIN] Notification error (non-fatal):', notifErr);
            }
          } else {
            console.error('[JOIN] Error opening auction:', openError);
          }
        } else {
          console.log(`[JOIN] Auction scheduled for ${auction.opens_at}, cron will handle it`);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, league: updatedLeague || league }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in leagues-join:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});