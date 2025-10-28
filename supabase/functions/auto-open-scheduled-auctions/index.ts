import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all scheduled auctions that should now be open
    const { data: scheduledAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, opens_at, league_id')
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