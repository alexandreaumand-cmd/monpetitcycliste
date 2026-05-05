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
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const supabase = createClient(url, srk, { auth: { persistSession: false, autoRefreshToken: false } });

  const nowIso = new Date().toISOString();
  const { data, error, count } = await supabase
    .from('auctions')
    .select('id, league_id, statut, opens_at', { count: 'exact' })
    .eq('statut', 'scheduled')
    .lte('opens_at', nowIso)
    .limit(2000);

  return new Response(
    JSON.stringify({
      url,
      url_host: url.replace(/^https?:\/\//, '').split('.')[0],
      has_srk: srk.length > 0,
      srk_prefix: srk.slice(0, 30),
      has_anon: anon.length > 0,
      anon_prefix: anon.slice(0, 30),
      now: nowIso,
      error: error?.message,
      count,
      returned: data?.length ?? 0,
      sample: data?.slice(0, 5),
    }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
