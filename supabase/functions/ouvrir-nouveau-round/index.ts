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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phase_id, deadline_at, league_id } = await req.json();
    console.log('Opening new round for phase:', phase_id, 'league:', league_id);

    // Verify user is admin of this league
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Non authentifié');
    }

    // Check if user is league admin
    const { data: isLeagueAdmin } = await supabase.rpc('is_league_admin', {
      l_id: league_id
    });

    if (!isLeagueAdmin) {
      throw new Error('Accès refusé: réservé aux administrateurs de la ligue');
    }

    // Get last auction for this phase and league
    const { data: lastAuction } = await supabase
      .from('auctions')
      .select('round_number')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

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