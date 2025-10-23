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
    // Create client with user's auth token to preserve auth.uid()
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    const { phase_id, deadline_at, league_id } = await req.json();
    console.log('Opening new round for phase:', phase_id, 'league:', league_id);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Check if user is league admin
    const { data: isLeagueAdmin, error: rpcError } = await supabase.rpc('is_league_admin', {
      l_id: league_id
    });

    console.log('League admin check result:', { isLeagueAdmin, rpcError, userId: user.id, leagueId: league_id });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw new Error('Erreur lors de la vérification des permissions');
    }

    if (!isLeagueAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs de la ligue' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get last auction for this phase and league (use maybeSingle to handle no results)
    const { data: lastAuction, error: auctionError } = await supabase
      .from('auctions')
      .select('round_number')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newRoundNumber = lastAuction ? lastAuction.round_number + 1 : 1;

    // Create new auction
    const { data: newAuction, error } = await supabase
      .from('auctions')
      .insert({
        phase_id,
        league_id,
        round_number: newRoundNumber,
        deadline_at,
        statut: 'open',
      })
      .select()
      .single();

    if (error) throw error;

    console.log('New round created:', newAuction);

    return new Response(
      JSON.stringify({ success: true, auction: newAuction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error opening new round:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});