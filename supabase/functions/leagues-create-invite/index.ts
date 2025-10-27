import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a secure random token
function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

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

    const { league_id, expires_at, max_uses, note } = await req.json();

    if (!league_id) {
      return new Response(JSON.stringify({ error: 'league_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin of the league
    const { data: isAdmin } = await supabase.rpc('is_league_admin', { l_id: league_id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = makeToken();
    const { data, error } = await supabase
      .from('league_invites')
      .insert({
        league_id,
        token,
        created_by: user.id,
        expires_at: expires_at || null,
        max_uses: max_uses ? Number(max_uses) : null,
        note: note || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating invite:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return only the invite and token; the UI will construct the full URL
    return new Response(JSON.stringify({ invite: data, token }), {
      status: 201,
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
