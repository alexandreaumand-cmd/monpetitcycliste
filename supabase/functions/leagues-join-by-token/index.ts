import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyLeagueMembers } from '../_shared/notifications.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[JOIN] No Authorization header present');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth client to verify user identity
    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await authedClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[JOIN] Authenticated user:', user.id, 'email:', user.email);
    // Service client to bypass RLS for invite lookup and member insert
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[JOIN] Processing token:', String(token).slice(0, 8) + '…');
    // Find the invite using service client (bypasses RLS)
    const { data: invite, error: inviteError } = await serviceClient
      .from('league_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (inviteError || !invite) {
      console.error('[JOIN] Invite lookup error:', inviteError);
      return new Response(JSON.stringify({ error: 'Invalid token', details: inviteError?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[JOIN] Found invite for league:', invite.league_id);

    // Check invite validity
    if (invite.is_revoked) {
      return new Response(JSON.stringify({ error: 'Invite revoked' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invite expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof invite.max_uses === 'number' && invite.uses_count >= invite.max_uses) {
      return new Response(JSON.stringify({ error: 'Invite limit reached' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leagueId = invite.league_id;

    // Check if manager profile exists (with retry for race condition with signup)
    let existingManager = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: manager } = await serviceClient
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (manager) {
        existingManager = manager;
        console.log('[JOIN] Manager profile found:', manager.id, 'after', attempt + 1, 'attempt(s)');
        break;
      }
      
      if (attempt < 4) {
        console.log('[JOIN] Manager not found, waiting... attempt', attempt + 1, '/ 5');
        await new Promise(r => setTimeout(r, 400));
      }
    }

    if (!existingManager) {
      console.error('[JOIN] Manager profile not found after retries for user', user.id);
      return new Response(JSON.stringify({ 
        error: 'MANAGER_NOT_FOUND', 
        details: 'Votre profil manager n\'est pas encore créé. Veuillez réessayer.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optional: Set the token in session for the trigger (if RPC exists)
    try {
      await authedClient.rpc('set_config', {
        parameter: 'app.invite_token',
        value: token,
        is_local: true,
      });
    } catch (e) {
      console.log('set_config RPC not available, trigger may not track usage');
    }

    // Add user to league using service client (bypasses RLS)
    console.log('[JOIN] Adding user to league:', leagueId);
    const { error: memberError } = await serviceClient
      .from('league_members')
      .upsert(
        {
          league_id: leagueId,
          user_id: user.id,
          role_in_league: 'member',
        },
        { onConflict: 'league_id,user_id' }
      );

    if (memberError) {
      console.error('[JOIN] Error adding member:', memberError);
      return new Response(JSON.stringify({ error: memberError.message, details: memberError.details }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[JOIN] User successfully added to league');

    // Get league info (re-fetch to get updated current_player_count)
    const { data: league } = await serviceClient
      .from('leagues')
      .select('name, visibility, settings, max_players, current_player_count, status')
      .eq('id', leagueId)
      .single();

    // Check if this was the last player joining → open auction if deadline passed
    if (league && league.current_player_count >= league.max_players) {
      console.log('[JOIN] League is now full! Checking for scheduled auctions...');
      
      const { data: scheduledAuctions } = await serviceClient
        .from('auctions')
        .select('id, opens_at, deadline_at, round_number')
        .eq('league_id', leagueId)
        .eq('statut', 'scheduled')
        .order('round_number', { ascending: true })
        .limit(1);

      if (scheduledAuctions && scheduledAuctions.length > 0) {
        const auction = scheduledAuctions[0];
        const opensAt = new Date(auction.opens_at);
        const now = new Date();

        if (opensAt <= now) {
          // Deadline already passed → open immediately with fresh 24h deadline
          const newDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
          
          const { error: openError } = await serviceClient
            .from('auctions')
            .update({ statut: 'open', deadline_at: newDeadline })
            .eq('id', auction.id)
            .eq('statut', 'scheduled');

          if (!openError) {
            console.log(`[JOIN] ✅ Opened auction ${auction.id} immediately (deadline had passed)`);
          } else {
            console.error('[JOIN] Error opening auction:', openError);
          }
        } else {
          console.log(`[JOIN] Auction scheduled for ${auction.opens_at}, cron will handle it`);
        }
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      league_id: leagueId,
      league_name: league?.name,
      league_visibility: league?.visibility,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
