import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      console.error('❌ Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phase_id, rider_id, amount: rawAmount, league_id } = await req.json();
    console.log('📥 Incoming bid request:', { 
      user_id: user.id, 
      phase_id, 
      rider_id, 
      amount: rawAmount, 
      league_id 
    });

    if (!phase_id || !rider_id || rawAmount === undefined || !league_id) {
      console.error('❌ Missing required fields:', { phase_id, rider_id, amount: rawAmount, league_id });
      return new Response(JSON.stringify({ error: 'Champs requis manquants (phase_id, rider_id, amount, league_id)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Force integer amount (no decimals allowed)
    const amount = Math.floor(Number(rawAmount));
    if (amount !== Number(rawAmount)) {
      console.warn(`⚠️ Decimal amount ${rawAmount} coerced to ${amount}`);
    }

    // Get manager_id from authenticated user only (security)
    const { data: manager, error: managerError } = await supabase
      .from('managers')
      .select('id, nom')
      .eq('user_id', user.id)
      .single();

    if (managerError || !manager) {
      console.error('❌ Manager not found for user:', user.id, managerError);
      return new Response(JSON.stringify({ error: 'Manager introuvable pour cet utilisateur' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const manager_id = manager.id;
    console.log('👤 Resolved manager:', { manager_id, manager_nom: manager.nom });

    // Check manager is a member of this league
    const { data: membership, error: membershipError } = await supabase
      .from('league_members')
      .select('id')
      .eq('league_id', league_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      console.error('❌ User is not a member of league:', { user_id: user.id, league_id });
      return new Response(
        JSON.stringify({ error: 'Vous devez être membre de cette ligue pour enchérir' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ League membership verified:', { user_id: user.id, league_id });

    // Get active auction for this league
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('id, round_number, league_id')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .eq('statut', 'open')
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (auctionError || !auction) {
      console.error('❌ No active auction found:', { phase_id, league_id, error: auctionError });
      return new Response(JSON.stringify({ error: 'Aucune enchère active pour cette ligue' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: Warning if request league_id ≠ auction.league_id (but proceed with auction.league_id)
    if (league_id !== auction.league_id) {
      console.warn('⚠️ League mismatch between request and auction!', { 
        request_league_id: league_id, 
        auction_league_id: auction.league_id,
        auction_id: auction.id
      });
    }

    console.log('🎯 Active auction found:', { 
      auction_id: auction.id, 
      league_id: auction.league_id, 
      round_number: auction.round_number 
    });

    // Get coureur info directly from coureurs_saisons, fallback to coureurs
    // This bypasses the view to avoid duplicate issues from equipes_saisons
    let coureur: { id: string; nom: string; prix_initial: number } | null = null;
    
    // First get saison_id from phase
    const { data: phaseData } = await supabase
      .from('phases')
      .select('saison_id')
      .eq('id', phase_id)
      .single();
    
    if (phaseData?.saison_id) {
      // Try coureurs_saisons with join to coureurs for nom (coureurs_saisons doesn't have nom column)
      const { data: coureurSaisonData } = await supabase
        .from('coureurs_saisons')
        .select('coureur_id, prix_initial, coureurs!inner(nom)')
        .eq('coureur_id', rider_id)
        .eq('saison_id', phaseData.saison_id)
        .limit(1);
      
      if (coureurSaisonData && coureurSaisonData.length > 0) {
        const row = coureurSaisonData[0];
        // coureurs is returned as object (not array) due to !inner join
        const coureurNom = (row as any).coureurs?.nom || 'Inconnu';
        coureur = {
          id: row.coureur_id,
          nom: coureurNom,
          prix_initial: row.prix_initial
        };
        console.log(`✅ [coureurs_saisons] Coureur ${rider_id}: prix_initial=${coureur.prix_initial}`);
      }
    }
    
    if (!coureur) {
      // Fallback to coureurs table
      const { data: coureurBaseData } = await supabase
        .from('coureurs')
        .select('id, nom, prix_initial')
        .eq('id', rider_id)
        .limit(1);
      
      if (coureurBaseData && coureurBaseData.length > 0) {
        coureur = coureurBaseData[0];
      }
    }

    if (!coureur) {
      console.error('❌ Rider not found:', { rider_id, phase_id });
      return new Response(JSON.stringify({ error: 'Coureur introuvable pour cette phase' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate amount >= prix_initial
    if (amount < coureur.prix_initial) {
      console.warn('⚠️ Bid amount below initial price:', { amount, prix_initial: coureur.prix_initial, coureur: coureur.nom });
      return new Response(
        JSON.stringify({ 
          error: `Le montant doit être au moins ${coureur.prix_initial} (prix initial de ${coureur.nom})` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if rider is already in manager's roster for this league and phase
    const { data: managerRoster } = await supabase
      .from('rosters')
      .select('id')
      .eq('manager_id', manager_id)
      .eq('coureur_id', rider_id)
      .eq('league_id', league_id)
      .eq('phase_id', phase_id)
      .maybeSingle();

    if (managerRoster) {
      console.warn('⚠️ Rider already in manager roster:', { manager_id, rider_id, league_id });
      return new Response(
        JSON.stringify({ error: 'Vous possédez déjà ce coureur dans votre roster pour cette phase' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if rider is already taken by another manager (in rosters)
    const { data: existingRoster } = await supabase
      .from('rosters')
      .select('id, manager_id')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .eq('coureur_id', rider_id)
      .maybeSingle();

    if (existingRoster) {
      console.warn('⚠️ Rider already assigned to another manager:', { 
        rider_id, 
        owner_manager_id: existingRoster.manager_id,
        requester_manager_id: manager_id 
      });
      return new Response(
        JSON.stringify({ error: 'Ce coureur a déjà été attribué à un autre manager' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current draft bids filtered by auction.league_id
    const { data: currentBids, error: bidsError } = await supabase
      .from('bids')
      .select('id, coureur_id, montant')
      .eq('auction_id', auction.id)
      .eq('manager_id', manager_id)
      .eq('league_id', auction.league_id)
      .eq('statut', 'draft');

    if (bidsError) {
      console.error('❌ Error fetching current bids:', bidsError);
    }

    // Calculate total if we add/update this bid
    const otherBidsSum = (currentBids || [])
      .filter(b => b.coureur_id !== rider_id)
      .reduce((sum, b) => sum + b.montant, 0);
    const newTotal = otherBidsSum + amount;

    console.log('💰 Budget calculation:', { 
      current_bids_count: currentBids?.length || 0,
      other_bids_sum: otherBidsSum,
      new_bid_amount: amount,
      new_total: newTotal 
    });

    // Get phase budget
    const { data: phase, error: phaseError } = await supabase
      .from('phases')
      .select('budget, max_coureurs')
      .eq('id', phase_id)
      .single();

    if (phaseError || !phase) {
      console.error('❌ Phase not found:', { phase_id, error: phaseError });
      return new Response(JSON.stringify({ error: 'Phase introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📊 Phase constraints:', { budget: phase.budget, max_coureurs: phase.max_coureurs });

    // Check budget (allow draft to exceed, will be validated on submit)
    // But return warning for UI feedback
    const budgetExceeded = newTotal > phase.budget;

    // Track if this is a new bid (for slot counting)
    const isNewBid = !currentBids?.some(b => b.coureur_id === rider_id);

    // UPSERT bid (draft status) - FORCE league_id from auction to prevent FK violations
    const { error: upsertError } = await supabase
      .from('bids')
      .upsert({
        auction_id: auction.id,
        manager_id,
        coureur_id: rider_id,
        montant: amount,
        statut: 'draft',
        round_number: auction.round_number,
        league_id: auction.league_id, // ✅ Use auction's league_id, not request's
      }, {
        onConflict: 'auction_id,manager_id,coureur_id',
      });

    if (upsertError) {
      console.error('❌ Error upserting bid:', upsertError);
      throw upsertError;
    }

    console.log('✅ Bid upserted successfully:', { 
      auction_id: auction.id, 
      manager_id, 
      rider_id, 
      amount,
      is_update: !isNewBid 
    });

    // Return refreshed context filtered by auction.league_id
    const { data: allBids } = await supabase
      .from('bids')
      .select('id, coureur_id, montant, statut')
      .eq('auction_id', auction.id)
      .eq('manager_id', manager_id)
      .eq('league_id', auction.league_id);

    const my_bids = (allBids || [])
      .filter(b => b.statut === 'draft')
      .map(b => ({ bid_id: b.id, coureur_id: b.coureur_id, amount: b.montant }));

    const draft_sum = my_bids.reduce((sum, b) => sum + b.amount, 0);
    const draft_count = my_bids.length;
    const remaining_budget = phase.budget - draft_sum;
    const remaining_slots = phase.max_coureurs - draft_count;

    // Build warnings array (non-blocking)
    const warnings: string[] = [];
    if (budgetExceeded) {
      warnings.push(`Budget dépassé de ${draft_sum - phase.budget}. Réduisez vos enchères avant validation.`);
    }
    if (draft_count > phase.max_coureurs) {
      warnings.push(`Tu as sélectionné ${draft_count} coureurs sur ${phase.max_coureurs} requis. Supprime ${draft_count - phase.max_coureurs} enchère(s) avant validation.`);
    }

    console.log('📤 Returning context:', { 
      draft_sum, 
      draft_count, 
      remaining_budget, 
      remaining_slots,
      has_warnings: warnings.length > 0 
    });

    return new Response(
      JSON.stringify({
        success: true,
        totals: { draft_sum, draft_count, remaining_budget, remaining_slots },
        warnings,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-upsert-bid:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
