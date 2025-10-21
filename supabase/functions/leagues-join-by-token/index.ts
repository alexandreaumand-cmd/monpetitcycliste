import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the invite (no league_id filter needed yet)
    const { data: invite, error: inviteError } = await supabase
      .from('league_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (inviteError || !invite) {
      console.error('Invite not found:', inviteError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Set the token in session for the trigger (optional, if RPC exists)
    try {
      await supabase.rpc('set_config', {
        parameter: 'app.invite_token',
        value: token,
        is_local: true,
      });
    } catch (e) {
      // If set_config RPC doesn't exist, log but continue
      console.log('set_config RPC not available, trigger may not track usage');
    }

    // Add user to league (upsert to avoid duplicates)
    const { error: memberError } = await supabase
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
      console.error('Error adding member:', memberError);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, league_id: leagueId }), {
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
