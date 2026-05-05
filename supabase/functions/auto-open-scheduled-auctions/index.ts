import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: mpcAuctions } = await supabase
    .from('auctions')
    .select('id, statut, round_number, phase_id, opens_at, deadline_at, closed_at')
    .eq('league_id', 'b5b46b5e-7c78-4ad9-a669-b08e8f099800')
    .order('opens_at', { ascending: true });

  const { data: eaAuctions } = await supabase
    .from('auctions')
    .select('id, statut, round_number, phase_id, opens_at, deadline_at, closed_at')
    .eq('league_id', '85d46f9b-62b4-48d6-b9e7-3ca6fc5a0062')
    .order('opens_at', { ascending: true });

  const { data: phases } = await supabase
    .from('phases')
    .select('id, index_dans_saison, date_debut, date_fin, saisons(annee)')
    .order('index_dans_saison');

  return new Response(
    JSON.stringify({ mpcAuctions, eaAuctions, phases, now: new Date().toISOString() }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
