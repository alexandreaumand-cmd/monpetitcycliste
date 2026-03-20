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

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { auction_id } = await req.json();
    if (!auction_id) {
      return new Response(JSON.stringify({ error: 'auction_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get manager from authenticated user
    const { data: manager } = await supabase
      .from('managers')
      .select('id, nom')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      return new Response(JSON.stringify({ error: 'Manager not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current pause state
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('id, announcements_paused')
      .eq('id', auction_id)
      .single();

    if (auctionError || !auction) {
      return new Response(JSON.stringify({ error: 'Auction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newPausedState = !auction.announcements_paused;

    // Toggle pause
    const { error: updateError } = await supabase
      .from('auctions')
      .update({
        announcements_paused: newPausedState,
        announcements_paused_by: newPausedState ? manager.id : null,
      })
      .eq('id', auction_id);

    if (updateError) throw updateError;

    console.log(`⏸ Auction ${auction_id} pause toggled to ${newPausedState} by ${manager.nom}`);

    return new Response(
      JSON.stringify({
        success: true,
        announcements_paused: newPausedState,
        paused_by_name: newPausedState ? manager.nom : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-toggle-pause:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
