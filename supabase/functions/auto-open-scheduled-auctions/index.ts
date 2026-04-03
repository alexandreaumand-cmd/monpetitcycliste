import { createClient } from 'npm:@supabase/supabase-js@2';
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find all scheduled auctions where opens_at has passed AND the league is active
    const { data: auctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, league_id, opens_at, deadline_at, round_number, phase_id')
      .eq('statut', 'scheduled')
      .lte('opens_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching scheduled auctions:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!auctions || auctions.length === 0) {
      return new Response(JSON.stringify({ message: 'No auctions to open', opened: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${auctions.length} scheduled auction(s) past opens_at`);

    // Get unique league IDs to check their status
    const leagueIds = [...new Set(auctions.map(a => a.league_id))];
    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, name, status')
      .in('id', leagueIds);

    const activeLeagueIds = new Set(
      (leagues || []).filter(l => l.status === 'active').map(l => l.id)
    );

    const leagueNames = Object.fromEntries(
      (leagues || []).map(l => [l.id, l.name])
    );

    // Only open auctions for active leagues
    const auctionsToOpen = auctions.filter(a => activeLeagueIds.has(a.league_id));

    if (auctionsToOpen.length === 0) {
      console.log('No auctions to open (leagues not active yet)');
      return new Response(JSON.stringify({ message: 'No active leagues with pending auctions', opened: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let opened = 0;
    for (const auction of auctionsToOpen) {
      // Recalculate deadline: 24h from now if the original deadline has also passed
      const originalDeadline = new Date(auction.deadline_at);
      const now = new Date();
      const newDeadline = originalDeadline > now 
        ? auction.deadline_at 
        : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('auctions')
        .update({ 
          statut: 'open',
          deadline_at: newDeadline
        })
        .eq('id', auction.id)
        .eq('statut', 'scheduled'); // Prevent race conditions

      if (updateError) {
        console.error(`Error opening auction ${auction.id}:`, updateError);
        continue;
      }

      opened++;
      console.log(`✅ Opened auction ${auction.id} for league ${auction.league_id} (round ${auction.round_number})`);

      // Send notifications
      try {
        await notifyLeagueMembers(supabase, auction.league_id, {
          type: 'auction_opened',
          title: '🔔 Enchères ouvertes !',
          message: `Le tour ${auction.round_number} des enchères est ouvert dans ${leagueNames[auction.league_id] || 'votre ligue'} !`,
          metadata: {
            league_id: auction.league_id,
            league_name: leagueNames[auction.league_id] || 'votre ligue',
            auction_id: auction.id,
            round_number: auction.round_number,
            deadline_at: newDeadline,
          },
        });
      } catch (notifErr) {
        console.error('Notification error (non-fatal):', notifErr);
      }
    }

    return new Response(
      JSON.stringify({ message: `Opened ${opened} auction(s)`, opened }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
