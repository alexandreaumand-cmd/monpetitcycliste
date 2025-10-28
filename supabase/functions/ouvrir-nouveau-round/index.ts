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
      // Fallback: direct check on league_members in case RPC fails or returns false unexpectedly
      const { data: membership, error: membershipError } = await supabase
        .from('league_members')
        .select('role_in_league')
        .eq('league_id', league_id)
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Direct role check result:', {
        role: membership?.role_in_league,
        membershipError,
        userId: user.id,
        leagueId: league_id,
      });

      if (membershipError) {
        console.error('Membership check error:', membershipError);
      }

      const role = membership?.role_in_league as string | undefined;
      if (!role || !['owner', 'admin'].includes(role)) {
        return new Response(
          JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs de la ligue' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fallback admin check passed via league_members for user:', user.id);
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

    // Notify all league members
    await notifyLeagueMembers(supabase, league_id, {
      type: 'auction_opened',
      title: `🎯 Nouveau round d'enchères ouvert !`,
      message: `Le round ${newRoundNumber} est maintenant ouvert. Placez vos enchères avant la deadline !`,
      metadata: {
        auction_id: newAuction.id,
        round_number: newRoundNumber,
        phase_id: phase_id,
        league_id: league_id,
        deadline_at: deadline_at
      }
    });

    return new Response(
      JSON.stringify({ success: true, auction: newAuction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error opening new round:', error);
    
    // Check for unique constraint violation (duplicate round number)
    const code = (error as any)?.code;
    const msg = (error as any)?.message || (error instanceof Error ? error.message : 'Unknown error');
    
    if (code === '23505') {
      return new Response(
        JSON.stringify({ 
          error: 'Un round avec ce numéro existe déjà pour cette phase dans cette ligue',
          code 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});