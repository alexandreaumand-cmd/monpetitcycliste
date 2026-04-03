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
    // Create client with user's auth token
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

    const { phase_id, league_id } = await req.json();
    console.log('Fixing carried_over bids for phase:', phase_id, 'league:', league_id);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get the currently open auction for this phase/league
    const { data: openAuction, error: openError } = await supabase
      .from('auctions')
      .select('id, round_number')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .eq('statut', 'open')
      .maybeSingle();

    if (openError) {
      console.error('Error fetching open auction:', openError);
      throw new Error('Erreur lors de la récupération de l\'enchère ouverte');
    }

    if (!openAuction) {
      console.log('No open auction found for this phase/league');
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated_count: 0,
          message: 'Aucune enchère ouverte trouvée pour cette phase/ligue' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Open auction found:', openAuction);

    // Step 2: Get the previous auction (round_number - 1)
    const previousRoundNumber = openAuction.round_number - 1;
    if (previousRoundNumber < 1) {
      console.log('No previous round exists (current round is 1)');
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated_count: 0,
          message: 'Pas de round précédent (round actuel = 1)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: previousAuction, error: prevError } = await supabase
      .from('auctions')
      .select('id, round_number')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .eq('round_number', previousRoundNumber)
      .maybeSingle();

    if (prevError || !previousAuction) {
      console.error('Error fetching previous auction:', prevError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated_count: 0,
          message: 'Round précédent introuvable' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Previous auction found:', previousAuction);

    // Step 3: Get carried_over bids from previous round
    const { data: carriedOverBids, error: carriedError } = await supabase
      .from('bids')
      .select('manager_id, coureur_id, montant')
      .eq('auction_id', previousAuction.id)
      .eq('league_id', league_id)
      .eq('statut', 'carried_over');

    if (carriedError) {
      console.error('Error fetching carried_over bids:', carriedError);
      throw new Error('Erreur lors de la récupération des bids carried_over');
    }

    console.log(`Found ${carriedOverBids?.length || 0} carried_over bids from previous round`);

    if (!carriedOverBids || carriedOverBids.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated_count: 0,
          message: 'Aucun bid carried_over trouvé dans le round précédent' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Get pending bids from current open round
    const { data: pendingBids, error: pendingError } = await supabase
      .from('bids')
      .select('id, manager_id, coureur_id, montant')
      .eq('auction_id', openAuction.id)
      .eq('league_id', league_id)
      .eq('statut', 'pending');

    if (pendingError) {
      console.error('Error fetching pending bids:', pendingError);
      throw new Error('Erreur lors de la récupération des bids pending');
    }

    console.log(`Found ${pendingBids?.length || 0} pending bids in current round`);

    if (!pendingBids || pendingBids.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated_count: 0,
          message: 'Aucun bid pending trouvé dans le round actuel' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Match and update pending bids that came from carried_over
    const bidsToUpdate: string[] = [];
    
    for (const pendingBid of pendingBids) {
      const matchesCarriedOver = carriedOverBids.some(
        carried => 
          carried.manager_id === pendingBid.manager_id &&
          carried.coureur_id === pendingBid.coureur_id &&
          carried.montant === pendingBid.montant
      );

      if (matchesCarriedOver) {
        bidsToUpdate.push(pendingBid.id);
      }
    }

    console.log(`Matched ${bidsToUpdate.length} pending bids to update to draft`);

    if (bidsToUpdate.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated_count: 0,
          message: 'Aucun bid pending correspondant aux carried_over trouvé' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Update matched bids to 'draft'
    const { data: updatedBids, error: updateError } = await supabase
      .from('bids')
      .update({ statut: 'draft' })
      .in('id', bidsToUpdate)
      .select('id');

    if (updateError) {
      console.error('Error updating bids to draft:', updateError);
      throw new Error('Erreur lors de la mise à jour des bids');
    }

    const updatedCount = updatedBids?.length || 0;
    console.log(`✅ Successfully updated ${updatedCount} pending bids to draft`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated_count: updatedCount,
        message: `${updatedCount} bids mis à jour de pending vers draft avec succès`,
        details: {
          open_auction_id: openAuction.id,
          open_round: openAuction.round_number,
          previous_round: previousRoundNumber,
          carried_over_found: carriedOverBids.length,
          pending_found: pendingBids.length,
          matched_and_updated: updatedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-fix-carried-over-to-draft:', error);
    
    const msg = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
