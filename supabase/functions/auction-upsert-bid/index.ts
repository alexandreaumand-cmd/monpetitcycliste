import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phase_id, manager_id: input_manager_id, rider_id, amount: rawAmount, league_id } = await req.json();

    if (!phase_id || !rider_id || rawAmount === undefined || !league_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields (phase_id, rider_id, amount, league_id)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Force integer amount (no decimals allowed)
    const amount = Math.floor(Number(rawAmount));
    if (amount !== Number(rawAmount)) {
      console.warn(`Decimal amount ${rawAmount} coerced to ${amount}`);
    }

    // Get manager_id
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      return new Response(JSON.stringify({ error: 'Manager not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const manager_id = input_manager_id || manager.id;

    // Get active auction
    const { data: auction } = await supabase
      .from('auctions')
      .select('id, round_number')
      .eq('phase_id', phase_id)
      .eq('statut', 'open')
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'No active auction' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get coureur info
    const { data: coureur } = await supabase
      .from('coureurs_disponibilite_enrichie')
      .select('id, nom, prix_initial')
      .eq('phase_id', phase_id)
      .eq('id', rider_id)
      .single();

    if (!coureur) {
      return new Response(JSON.stringify({ error: 'Rider not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate amount >= prix_initial
    if (amount < coureur.prix_initial) {
      return new Response(
        JSON.stringify({ 
          error: `Le montant doit être au moins ${coureur.prix_initial} (prix initial de ${coureur.nom})` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if rider is already taken (in rosters)
    const { data: existingRoster } = await supabase
      .from('rosters')
      .select('id')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .eq('coureur_id', rider_id)
      .single();

    if (existingRoster) {
      return new Response(
        JSON.stringify({ error: 'Ce coureur a déjà été attribué' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current draft bids to check budget
    const { data: currentBids } = await supabase
      .from('bids')
      .select('id, coureur_id, montant')
      .eq('auction_id', auction.id)
      .eq('manager_id', manager_id)
      .eq('statut', 'draft');

    // Calculate total if we add/update this bid
    const otherBidsSum = (currentBids || [])
      .filter(b => b.coureur_id !== rider_id)
      .reduce((sum, b) => sum + b.montant, 0);
    const newTotal = otherBidsSum + amount;

    // Get phase budget
    const { data: phase } = await supabase
      .from('phases')
      .select('budget, max_coureurs')
      .eq('id', phase_id)
      .single();

    if (!phase) {
      return new Response(JSON.stringify({ error: 'Phase not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check budget (allow draft to exceed, will be validated on submit)
    // But return warning for UI feedback
    const budgetExceeded = newTotal > phase.budget;

    // Check max_bids (only if adding new bid)
    const isNewBid = !currentBids?.some(b => b.coureur_id === rider_id);
    if (isNewBid && currentBids && currentBids.length >= phase.max_coureurs) {
      return new Response(
        JSON.stringify({ 
          error: `Nombre maximum d'enchères atteint (${phase.max_coureurs})` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPSERT bid (draft status)
    const { error: upsertError } = await supabase
      .from('bids')
      .upsert({
        auction_id: auction.id,
        manager_id,
        coureur_id: rider_id,
        montant: amount,
        statut: 'draft',
        round_number: auction.round_number,
        league_id: league_id,
      }, {
        onConflict: 'auction_id,manager_id,coureur_id',
      });

    if (upsertError) throw upsertError;

    // Return refreshed context (call auction-get-context logic inline to avoid extra roundtrip)
    const { data: allBids } = await supabase
      .from('bids')
      .select('id, coureur_id, montant, statut')
      .eq('auction_id', auction.id)
      .eq('manager_id', manager_id);

    const my_bids = (allBids || [])
      .filter(b => b.statut === 'draft')
      .map(b => ({ bid_id: b.id, coureur_id: b.coureur_id, amount: b.montant }));

    const draft_sum = my_bids.reduce((sum, b) => sum + b.amount, 0);
    const draft_count = my_bids.length;
    const remaining_budget = phase.budget - draft_sum;
    const remaining_slots = phase.max_coureurs - draft_count;

    return new Response(
      JSON.stringify({
        success: true,
        totals: { draft_sum, draft_count, remaining_budget, remaining_slots },
        warnings: budgetExceeded ? ['Budget dépassé - validation bloquée jusqu\'à correction'] : [],
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
