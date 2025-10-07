import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { auction_id, publish_all } = await req.json();
    console.log('Publishing annonce for auction:', auction_id, 'publish_all:', publish_all);

    if (publish_all) {
      // Publish all unpublished annonces
      const { data, error } = await supabase
        .from('annonces')
        .update({ published: true, published_at: new Date().toISOString() })
        .eq('auction_id', auction_id)
        .eq('published', false)
        .select();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, count: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Publish next annonce (lowest price first)
      const { data: annonce, error } = await supabase
        .from('annonces')
        .select('*, coureurs(*), managers(*)')
        .eq('auction_id', auction_id)
        .eq('published', false)
        .order('winning_amount', { ascending: true })
        .limit(1)
        .single();

      if (error || !annonce) {
        return new Response(
          JSON.stringify({ success: false, message: 'Aucune annonce à publier' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as published
      await supabase
        .from('annonces')
        .update({ published: true, published_at: new Date().toISOString() })
        .eq('id', annonce.id);

      // Generate announcement text
      let text = '';
      if (annonce.type === 'gain') {
        const losersList = (annonce.losers_json as any[])
          .map((l) => `${l.manager} (${l.montant.toFixed(1)})`)
          .join(' · ');

        text = `🥁 [Round ${annonce.round_number}] ${annonce.coureurs.nom} — GAGNÉ par ${annonce.managers.nom} à ${annonce.winning_amount.toFixed(1)} €.\n${losersList ? `Managers battus : ${losersList}.` : ''}`;
      } else {
        const exAequoList = (annonce.losers_json as any[])
          .map((l) => l.manager)
          .join(', ');

        text = `🟨 [Round ${annonce.round_number}] ${annonce.coureurs.nom} — ÉGALITÉ au montant max ${annonce.winning_amount.toFixed(1)} € entre : ${exAequoList}.\nLe coureur repart au PROCHAIN ROUND.`;
      }

      return new Response(
        JSON.stringify({ success: true, annonce, text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error publishing annonce:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});