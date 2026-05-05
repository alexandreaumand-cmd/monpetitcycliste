import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const supabase = createClient(url, srk, { auth: { persistSession: false, autoRefreshToken: false } });

  // Test 1: count all auctions
  const { count: totalAuctions } = await supabase
    .from('auctions')
    .select('*', { count: 'exact', head: true });

  // Test 2: count scheduled auctions
  const { count: scheduledCount } = await supabase
    .from('auctions')
    .select('*', { count: 'exact', head: true })
    .eq('statut', 'scheduled');

  // Test 3: count leagues
  const { count: totalLeagues } = await supabase
    .from('leagues')
    .select('*', { count: 'exact', head: true });

  // Test 4: try to fetch the specific MPC 2026 auction by id
  const { data: mpcAuction } = await supabase
    .from('auctions')
    .select('id, league_id, statut, opens_at')
    .eq('id', '595196b4-c679-4c30-9fc7-632267e27f9d')
    .maybeSingle();

  // Test 5: try to fetch MPC 2026 league
  const { data: mpcLeague } = await supabase
    .from('leagues')
    .select('id, name, status')
    .eq('id', 'b5b46b5e-7c78-4ad9-a669-b08e8f099800')
    .maybeSingle();

  return new Response(
    JSON.stringify({
      url,
      totalAuctions,
      scheduledCount,
      totalLeagues,
      mpcAuction,
      mpcLeague,
    }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
