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
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}`;

    let supabase;

    const { auction_id, league_id, auto_mode } = await req.json();

    if (auto_mode && isServiceRoleCall) {
      // Auto mode: called from auction-submit-all-bids with service role
      console.log('🤖 Auto-mode: bypassing admin check (service role call)');
      supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        serviceRoleKey
      );
    } else {
      // Manual mode: require user auth and admin check
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Non authentifié' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      supabase = createClient(
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

      // Verify user authentication and admin permissions
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Non authentifié' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: isLeagueAdmin } = await supabase.rpc('is_league_admin', { l_id: league_id });

      if (!isLeagueAdmin) {
        // Check if user is superadmin
        const { data: isSuperAdmin } = await supabase.rpc('is_superadmin');

        if (isSuperAdmin) {
          console.log('🔑 Superadmin bypass: allowing round close for any league');
          // Switch to service role client so RLS doesn't block operations
          supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            serviceRoleKey
          );
        } else {
          const { data: membership } = await supabase
            .from('league_members')
            .select('role_in_league')
            .eq('league_id', league_id)
            .eq('user_id', user.id)
            .maybeSingle();

          const role = membership?.role_in_league as string | undefined;
          if (!role || !['owner', 'admin'].includes(role)) {
            return new Response(
              JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs de la ligue' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    console.log('Closing round for auction:', auction_id, 'league:', league_id, 'auto_mode:', auto_mode || false);

    // Get auction details and verify it belongs to the league
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
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

    // Use the effective_phase_id locked at auction creation (no dynamic resolution)
    const effectivePhaseId = auction.effective_phase_id ?? auction.phase_id;
    console.log(`Using effective phase: ${effectivePhaseId} (auction phase: ${auction.phase_id})`);

    // Close the auction
    await supabase
      .from('auctions')
      .update({ statut: 'closed', closed_at: new Date().toISOString() })
      .eq('id', auction_id);

    // CRITICAL: Get all pending bids for this auction AND league
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select('*, coureurs(*), managers(*)')
      .eq('auction_id', auction_id)
      .eq('league_id', league_id)
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

        // Create roster entry with error handling
        const { error: rosterError } = await supabase.from('rosters').insert({
          phase_id: effectivePhaseId,
          manager_id: winner.manager_id,
          coureur_id,
          prix_signature: maxAmount,
          league_id: league_id,
        });

        if (rosterError) {
          console.error('❌ Failed to insert roster:', {
            coureur_id,
            manager_id: winner.manager_id,
            manager_nom: winner.managers.nom,
            prix: maxAmount,
            error: rosterError.message,
            details: rosterError
          });
          
          // If insertion fails, treat as tie (carried over to next round)
          const carryOverIds = [winner.id];
          const lostIds = losers.map((b) => b.id);

          if (carryOverIds.length > 0) {
            await supabase.from('bids').update({ statut: 'carried_over' }).in('id', carryOverIds);
          }
          if (lostIds.length > 0) {
            await supabase.from('bids').update({ statut: 'lost' }).in('id', lostIds);
          }

          // Create tie annonce instead of win
          annonces.push({
            auction_id,
            round_number: auction.round_number,
            coureur_id,
            type: 'egalite',
            winning_manager_id: null,
            winning_amount: maxAmount,
            losers_json: [{
              manager: winner.managers.nom,
              montant: parseFloat(winner.montant),
            }, ...losers.map((b) => ({
              manager: b.managers.nom,
              montant: parseFloat(b.montant),
            }))],
          });

          continue; // Skip to next rider
        }

        console.log('✅ Roster created successfully:', {
          coureur_id,
          manager_nom: winner.managers.nom,
          prix: maxAmount
        });

        // Update bids (only if roster insertion succeeded)
        await supabase.from('bids').update({ statut: 'won' }).eq('id', winner.id);
        if (losers.length > 0) {
          await supabase.from('bids').update({ statut: 'lost' }).in('id', losers.map((b) => b.id));
        }

        // Create annonce (only if everything succeeded)
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

    // CRITICAL: Update any remaining "pending" bids to "closed" to prevent them from appearing as validated in next round
    const { data: remainingBids, error: remainingError } = await supabase
      .from('bids')
      .update({ statut: 'closed' })
      .eq('auction_id', auction_id)
      .eq('league_id', league_id)
      .eq('statut', 'pending')
      .select('id');

    if (remainingError) {
      console.error('Error updating remaining bids:', remainingError);
    } else {
      console.log(`Updated ${remainingBids?.length || 0} remaining pending bids to closed`);
    }

    console.log(`Round closed, ${annonces.length} annonces created`);

    // Set started_at_effective on first auction close (J+1)
    const { data: leagueRow } = await supabase
      .from('leagues')
      .select('started_at_effective')
      .eq('id', league_id)
      .single();

    if (leagueRow && !leagueRow.started_at_effective) {
      const effectiveDate = new Date().toISOString().split('T')[0];
      console.log(`Setting started_at_effective for league ${league_id} to ${effectiveDate}`);
      await supabase
        .from('leagues')
        .update({ started_at_effective: effectiveDate })
        .eq('id', league_id);
    }

    // Fetch league name for notification context
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', league_id)
      .single();
    const leagueName = leagueData?.name || 'Ligue';

    // Notify all league members
    await notifyLeagueMembers(supabase, league_id, {
      type: 'auction_closed',
      title: `⏰ Round d'enchères clôturé`,
      message: `Le round ${auction.round_number} est maintenant terminé. Consultez les résultats !`,
      metadata: {
        auction_id: auction_id,
        round_number: auction.round_number,
        phase_id: auction.phase_id,
        league_id: league_id,
        league_name: leagueName,
        annonces_count: annonces.length
      }
    });

    // In auto mode, automatically publish all annonces with 10s intervals
    if (auto_mode && annonces.length > 0) {
      console.log('🤖 Auto-mode: triggering automatic annonce publication...');
      
      // Use service role client to call publier-annonce
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { error: publishError } = await serviceSupabase.functions.invoke('publier-annonce', {
        body: {
          auction_id: auction_id,
          publish_all: true,
          auto_mode: true,
        }
      });
      
      if (publishError) {
        console.error('❌ Error auto-publishing annonces:', publishError);
      } else {
        console.log('✅ Auto-publish triggered successfully');
      }
    }

    return new Response(
      JSON.stringify({ success: true, annonces_count: annonces.length, auto_mode: auto_mode || false }),
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