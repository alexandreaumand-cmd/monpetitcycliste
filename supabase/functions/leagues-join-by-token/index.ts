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
    // Auth client to verify user identity
    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
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

    // Ensure manager profile exists
    const { data: existingManager } = await serviceClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingManager) {
      console.log('[JOIN] Creating manager profile for user', user.id);
      const { error: managerError } = await serviceClient
        .from('managers')
        .insert({
          user_id: user.id,
          nom: user.email?.split('@')[0] || 'Manager',
          email: user.email,
        });

      if (managerError) {
        console.error('[JOIN] Error creating manager:', managerError);
        return new Response(JSON.stringify({ error: 'Failed to create manager profile', details: managerError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('[JOIN] Manager profile created successfully');
    } else {
      console.log('[JOIN] Manager profile already exists:', existingManager.id);
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

    // Get league info
    const { data: league } = await serviceClient
      .from('leagues')
      .select('name, visibility, settings')
      .eq('id', leagueId)
      .single();

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
