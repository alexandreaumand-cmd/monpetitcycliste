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

    const { auction_id, league_id } = await req.json();
    console.log('Closing round for auction:', auction_id, 'league:', league_id);

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

    // Get auction details
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*, phases(*)')
      .eq('id', auction_id)
      .single();

    if (auctionError || !auction) {
      throw new Error('Auction not found');
    }

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