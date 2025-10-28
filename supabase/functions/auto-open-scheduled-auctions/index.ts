import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyLeagueMembers } from '../_shared/notifications.ts';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all scheduled auctions that should now be open
    const { data: scheduledAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, opens_at, league_id, round_number, phase_id, deadline_at')
      .eq('statut', 'scheduled')
      .lte('opens_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching scheduled auctions:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!scheduledAuctions || scheduledAuctions.length === 0) {
      console.log('No scheduled auctions to open');
      return new Response(
        JSON.stringify({ message: 'No auctions to open', count: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update all scheduled auctions to 'open'
    const { data, error: updateError } = await supabase
      .from('auctions')
      .update({ statut: 'open' })
      .in('id', scheduledAuctions.map(a => a.id))
      .select();

    if (updateError) {
      console.error('Error updating auctions to open:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Opened ${data?.length || 0} scheduled auctions`);

    // Notify league members for each opened auction
    if (data && data.length > 0) {
      for (const auction of data) {
        await notifyLeagueMembers(supabase, auction.league_id, {
          type: 'auction_opened',
          title: `🎯 Nouveau round d'enchères ouvert !`,
          message: `Le round ${auction.round_number} est maintenant ouvert. Placez vos enchères avant la deadline !`,
          metadata: {
            auction_id: auction.id,
            round_number: auction.round_number,
            phase_id: auction.phase_id,
            league_id: auction.league_id,
            deadline_at: auction.deadline_at
          }
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Auctions opened successfully', 
        count: data?.length || 0,
        auction_ids: data?.map(a => a.id) || []
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-open-scheduled-auctions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});