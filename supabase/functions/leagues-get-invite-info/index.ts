import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token manquant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the invite
    const { data: invite, error: inviteError } = await serviceClient
      .from('league_invites')
      .select('league_id, expires_at, max_uses, uses_count, is_revoked')
      .eq('token', token)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invitation introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check validity
    if (invite.is_revoked) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Cette invitation a été révoquée' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Cette invitation a expiré' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof invite.max_uses === 'number' && invite.uses_count >= invite.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Cette invitation a atteint sa limite d\'utilisations' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get league info
    const { data: league, error: leagueError } = await serviceClient
      .from('leagues')
      .select('name, visibility')
      .eq('id', invite.league_id)
      .single();

    if (leagueError || !league) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Ligue introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count members
    const { count: memberCount } = await serviceClient
      .from('league_members')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', invite.league_id);

    return new Response(
      JSON.stringify({
        valid: true,
        league_name: league.name,
        league_visibility: league.visibility,
        member_count: memberCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
