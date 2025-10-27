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

    const { auction_id, league_id } = await req.json();
    
    if (!league_id) {
      throw new Error('league_id est requis');
    }
    
    console.log('Closing round for auction:', auction_id, 'league:', league_id);

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

    // Get auction details and verify it belongs to the league
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*, phases(*)')
      .eq('id', auction_id)
      .single();

    if (auctionError || !auction) {
      console.error('Auction not found:', auctionError);
      throw new Error('Auction not found');
    }

    // Verify auction belongs to the specified league
    if (auction.league_id !== league_id) {
      console.error('League mismatch:', { auction_league: auction.league_id, requested_league: league_id });
      return new Response(
        JSON.stringify({ error: 'L\'enchère ne correspond pas à la ligue spécifiée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auction verified:', { id: auction.id, league_id: auction.league_id, round: auction.round_number });

    // Close the auction
    await supabase
      .from('auctions')
      .update({ statut: 'closed', closed_at: new Date().toISOString() })
      .eq('id', auction_id);

    // Get all pending bids grouped by coureur
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select('*, coureurs(*), managers(*)')
      .eq('auction_id', auction_id)
      .eq('statut', 'pending');

    if (bidsError) throw bidsError;

    // Group bids by coureur
    const bidsByCoureur: { [key: string]: any[] } = {};
    bids?.forEach((bid) => {
      if (!bidsByCoureur[bid.coureur_id]) {
        bidsByCoureur[bid.coureur_id] = [];
      }
      bidsByCoureur[bid.coureur_id].push(bid);
    });

    const annonces = [];

    // Process each coureur
    for (const [coureur_id, coureurBids] of Object.entries(bidsByCoureur)) {
      const maxAmount = Math.max(...coureurBids.map((b) => parseFloat(b.montant)));
      const maxBids = coureurBids.filter((b) => parseFloat(b.montant) === maxAmount);

      if (maxBids.length >= 2) {
        // Égalité - carried_over
        const carryOverIds = maxBids.map((b) => b.id);
        const lostIds = coureurBids.filter((b) => !carryOverIds.includes(b.id)).map((b) => b.id);

        if (carryOverIds.length > 0) {
          await supabase.from('bids').update({ statut: 'carried_over' }).in('id', carryOverIds);
        }
        if (lostIds.length > 0) {
          await supabase.from('bids').update({ statut: 'lost' }).in('id', lostIds);
        }

        // Create annonce
        annonces.push({
          auction_id,
          round_number: auction.round_number,
          coureur_id,
          type: 'egalite',
          winning_manager_id: null,
          winning_amount: maxAmount,
          losers_json: maxBids.map((b) => ({
            manager: b.managers.nom,
            montant: parseFloat(b.montant),
          })),
        });
      } else {
        // Gagnant unique
        const winner = maxBids[0];
        const losers = coureurBids.filter((b) => b.id !== winner.id);

        // Create roster entry
        await supabase.from('rosters').insert({
          phase_id: auction.phase_id,
          manager_id: winner.manager_id,
          coureur_id,
          prix_signature: maxAmount,
          league_id: league_id,
        });

        // Update bids
        await supabase.from('bids').update({ statut: 'won' }).eq('id', winner.id);
        if (losers.length > 0) {
          await supabase.from('bids').update({ statut: 'lost' }).in('id', losers.map((b) => b.id));
        }

        // Create annonce
        annonces.push({
          auction_id,
          round_number: auction.round_number,
          coureur_id,
          type: 'gain',
          winning_manager_id: winner.manager_id,
          winning_amount: maxAmount,
          losers_json: losers.map((b) => ({
            manager: b.managers.nom,
            montant: parseFloat(b.montant),
          })),
        });
      }
    }

    // Sort annonces by winning_amount (ascending) before inserting
    if (annonces.length > 0) {
      const sortedAnnonces = annonces.sort((a, b) => a.winning_amount - b.winning_amount);
      await supabase.from('annonces').insert(sortedAnnonces);
    }

    console.log(`Round closed, ${annonces.length} annonces created`);

    return new Response(
      JSON.stringify({ success: true, annonces_count: annonces.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error closing round:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});