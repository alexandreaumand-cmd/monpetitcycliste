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

    const { phase_id } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get active auction
    const { data: auction } = await supabase
      .from('auctions')
      .select('id, round_number, deadline_at')
      .eq('phase_id', phase_id)
      .eq('statut', 'open')
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Aucune enchère active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get managers with pending bids (validated)
    const { data: validatedManagers } = await supabase
      .from('bids')
      .select(`
        manager_id,
        managers!inner(nom)
      `)
      .eq('auction_id', auction.id)
      .eq('statut', 'pending');

    // Get managers with draft bids (waiting)
    const { data: waitingManagers } = await supabase
      .from('bids')
      .select(`
        manager_id,
        managers!inner(nom)
      `)
      .eq('auction_id', auction.id)
      .eq('statut', 'draft');

    // Extract unique manager names
    const validatedNames = [...new Set(
      (validatedManagers || []).map((b: any) => b.managers.nom)
    )];
    
    const waitingNames = [...new Set(
      (waitingManagers || []).map((b: any) => b.managers.nom)
    )];

    const totalManagers = validatedNames.length + waitingNames.length;

    return new Response(
      JSON.stringify({
        auction_id: auction.id,
        round_number: auction.round_number,
        deadline_at: auction.deadline_at,
        validated_count: validatedNames.length,
        waiting_count: waitingNames.length,
        total_managers: totalManagers,
        validated_managers: validatedNames.sort(),
        waiting_managers: waitingNames.sort(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-get-validation-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
