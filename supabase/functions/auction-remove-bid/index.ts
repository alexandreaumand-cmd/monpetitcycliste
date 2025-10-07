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

    const { bid_id } = await req.json();

    if (!bid_id) {
      return new Response(JSON.stringify({ error: 'bid_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Check bid exists and is draft
    const { data: bid } = await supabase
      .from('bids')
      .select('id, statut, manager_id, auction_id')
      .eq('id', bid_id)
      .single();

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Bid not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (bid.manager_id !== manager.id) {
      return new Response(JSON.stringify({ error: 'Not your bid' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (bid.statut !== 'draft') {
      return new Response(
        JSON.stringify({ error: 'Seules les enchères brouillons peuvent être supprimées' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete bid
    const { error: deleteError } = await supabase
      .from('bids')
      .delete()
      .eq('id', bid_id);

    if (deleteError) throw deleteError;

    // Get auction info for phase_id
    const { data: auction } = await supabase
      .from('auctions')
      .select('phase_id')
      .eq('id', bid.auction_id)
      .single();

    // Return refreshed totals
    const { data: remainingBids } = await supabase
      .from('bids')
      .select('montant')
      .eq('auction_id', bid.auction_id)
      .eq('manager_id', manager.id)
      .eq('statut', 'draft');

    const { data: phase } = await supabase
      .from('phases')
      .select('budget, max_coureurs')
      .eq('id', auction?.phase_id)
      .single();

    const draft_sum = (remainingBids || []).reduce((sum, b) => sum + b.montant, 0);
    const draft_count = (remainingBids || []).length;
    const remaining_budget = (phase?.budget || 0) - draft_sum;
    const remaining_slots = (phase?.max_coureurs || 0) - draft_count;

    return new Response(
      JSON.stringify({
        success: true,
        totals: { draft_sum, draft_count, remaining_budget, remaining_slots },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-remove-bid:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
