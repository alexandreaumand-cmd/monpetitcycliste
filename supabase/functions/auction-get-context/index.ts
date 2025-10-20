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

    const { phase_id, manager_id: input_manager_id, league_id } = await req.json();

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

    // Get phase info with saison_id
    const { data: phase } = await supabase
      .from('phases')
      .select('budget, max_coureurs, saison_id')
      .eq('id', phase_id)
      .single();

    if (!phase) {
      return new Response(JSON.stringify({ error: 'Phase not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get active auction for this phase
    let auctionQuery = supabase
      .from('auctions')
      .select('id, round_number, statut, deadline_at')
      .eq('phase_id', phase_id)
      .eq('statut', 'open');
    
    if (league_id) {
      auctionQuery = auctionQuery.eq('league_id', league_id);
    }
    
    const { data: auction } = await auctionQuery
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ 
        error: 'No active auction',
        phase_id,
        manager_id,
        starting_budget: phase.budget,
        currency: '€',
        rules: { min_bid: 1, step: 1, max_bids: phase.max_coureurs },
        my_bids: [],
        submitted_bids: [],
        totals: { 
          draft_sum: 0, 
          draft_count: 0, 
          remaining_budget: phase.budget, 
          remaining_slots: phase.max_coureurs,
          roster_count: 0,
          budget_spent: 0
        },
        validation_status: {
          has_exact_slots: false,
          budget_fully_used: false,
          all_above_min: false,
          no_duplicates: true,
          no_taken_riders: true,
          can_submit: false
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all bids for this manager in this auction
    let bidsQuery = supabase
      .from('bids')
      .select('id, coureur_id, montant, statut, created_at')
      .eq('auction_id', auction.id)
      .eq('manager_id', manager_id);
    
    if (league_id) {
      bidsQuery = bidsQuery.eq('league_id', league_id);
    }
    
    const { data: allBids } = await bidsQuery;

    const my_bids = (allBids || [])
      .filter(b => b.statut === 'draft')
      .map(b => ({ bid_id: b.id, coureur_id: b.coureur_id, amount: b.montant }));

    const submitted_bids = (allBids || [])
      .filter(b => b.statut === 'pending')
      .map(b => ({ bid_id: b.id, coureur_id: b.coureur_id, amount: b.montant }));

    const has_validated = submitted_bids.length > 0;

    // Get existing roster with rider details from coureurs_saisons
    let rosterQuery = supabase
      .from('rosters')
      .select(`
        coureur_id,
        prix_signature
      `)
      .eq('manager_id', manager_id)
      .eq('phase_id', phase_id);
    
    if (league_id) {
      rosterQuery = rosterQuery.eq('league_id', league_id);
    }
    
    const { data: existingRoster } = await rosterQuery;

    // Enrich roster with coureurs_saisons data
    const rosterCoureurIds = (existingRoster || []).map(r => r.coureur_id);
    const { data: rosterCoureurs } = rosterCoureurIds.length > 0 ? await supabase
      .from('coureurs_saisons')
      .select('coureur_id, coureurs!inner(id, nom), equipe, prix_initial')
      .eq('saison_id', phase.saison_id)
      .in('coureur_id', rosterCoureurIds)
      : { data: [] };

    const rosterCoureursMap = new Map((rosterCoureurs || []).map((cs: any) => [
      cs.coureur_id,
      {
        id: cs.coureurs?.id || cs.coureur_id,
        nom: cs.coureurs?.nom || '',
        equipe: cs.equipe,
        prix_initial: cs.prix_initial
      }
    ]));

    const roster_count = existingRoster?.length || 0;
    const budget_spent = existingRoster?.reduce((sum, r) => sum + Number(r.prix_signature), 0) || 0;

    // Get round numbers from annonces
    const { data: rosterAnnonces } = await supabase
      .from('annonces')
      .select('coureur_id, round_number, winning_amount')
      .eq('winning_manager_id', manager_id)
      .in('coureur_id', (existingRoster || []).map(r => r.coureur_id));

    const roundMap = new Map((rosterAnnonces || []).map(a => [a.coureur_id, a.round_number]));

    const enriched_roster = (existingRoster || []).map((r: any) => {
      const coureur = rosterCoureursMap.get(r.coureur_id);
      return {
        coureur_id: r.coureur_id,
        rider_nom: coureur?.nom || '',
        rider_team: coureur?.equipe || '',
        amount: Number(r.prix_signature),
        round_number: roundMap.get(r.coureur_id) || null,
        is_existing: true,
        cote: coureur?.prix_initial || null,
      };
    });

    // Get coureur details for bids from coureurs_saisons
    const coureur_ids = [...my_bids, ...submitted_bids].map(b => b.coureur_id);
    const { data: coureurs } = coureur_ids.length > 0 ? await supabase
      .from('coureurs_saisons')
      .select('coureur_id, coureurs!inner(id, nom), equipe, prix_initial')
      .eq('saison_id', phase.saison_id)
      .in('coureur_id', coureur_ids)
      : { data: [] };

    const coureursMap = new Map((coureurs || []).map((cs: any) => [
      cs.coureur_id,
      {
        id: cs.coureurs?.id || cs.coureur_id,
        nom: cs.coureurs?.nom || '',
        equipe: cs.equipe,
        prix_initial: cs.prix_initial
      }
    ]));

    // Enrich bids with coureur info
    const enriched_my_bids = my_bids.map(b => ({
      ...b,
      rider_nom: coureursMap.get(b.coureur_id)?.nom || '',
      rider_team: coureursMap.get(b.coureur_id)?.equipe || '',
      cote: coureursMap.get(b.coureur_id)?.prix_initial || null,
    }));

    const enriched_submitted_bids = submitted_bids.map(b => ({
      ...b,
      rider_nom: coureursMap.get(b.coureur_id)?.nom || '',
      rider_team: coureursMap.get(b.coureur_id)?.equipe || '',
      cote: coureursMap.get(b.coureur_id)?.prix_initial || null,
    }));

    // Calculate totals (including existing roster)
    const draft_sum = my_bids.reduce((sum, b) => sum + b.amount, 0);
    const draft_count = my_bids.length;
    const remaining_budget = phase.budget - budget_spent - draft_sum;
    const remaining_slots = phase.max_coureurs - roster_count - draft_count;

    // Check if coureurs are already taken (in rosters)
    let takenQuery = supabase
      .from('rosters')
      .select('coureur_id')
      .eq('phase_id', phase_id)
      .in('coureur_id', my_bids.map(b => b.coureur_id));
    
    if (league_id) {
      takenQuery = takenQuery.eq('league_id', league_id);
    }
    
    const { data: takenRiders } = await takenQuery;

    const takenRiderIds = new Set((takenRiders || []).map(r => r.coureur_id));
    const no_taken_riders = my_bids.every(b => !takenRiderIds.has(b.coureur_id));

    // Check duplicates
    const coureurIdsSet = new Set(my_bids.map(b => b.coureur_id));
    const no_duplicates = coureurIdsSet.size === draft_count;

    // Check all amounts >= prix_initial
    const all_above_min = my_bids.every(b => {
      const coureur = coureursMap.get(b.coureur_id);
      return coureur ? b.amount >= coureur.prix_initial : false;
    });

    // Validation status
    const has_exact_slots = (roster_count + draft_count) === phase.max_coureurs;
    const budget_fully_used = Math.abs(remaining_budget) < 1;
    const can_submit = has_exact_slots && budget_fully_used && all_above_min && no_duplicates && no_taken_riders;

    return new Response(
      JSON.stringify({
        phase_id,
        manager_id,
        auction_id: auction.id,
        auction: {
          id: auction.id,
          round_number: auction.round_number,
          statut: auction.statut,
          deadline_at: auction.deadline_at
        },
        starting_budget: phase.budget,
        currency: '€',
        rules: { min_bid: 1, step: 1, max_bids: phase.max_coureurs },
        roster: enriched_roster,
        my_bids: enriched_my_bids,
        submitted_bids: enriched_submitted_bids,
        totals: { draft_sum, draft_count, remaining_budget, remaining_slots, roster_count, budget_spent },
        validation_status: {
          has_exact_slots,
          budget_fully_used,
          all_above_min,
          no_duplicates,
          no_taken_riders,
          can_submit,
          has_validated,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-get-context:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
