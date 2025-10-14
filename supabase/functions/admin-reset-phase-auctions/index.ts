import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Non authentifié');
    }

    // Check admin access
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc('is_admin');
    if (adminError || !isAdmin) {
      throw new Error('Accès refusé: réservé aux administrateurs');
    }

    const { phase_id, confirm_phrase } = await req.json();

    // Verify confirmation phrase
    if (confirm_phrase !== 'RESET ENCHERES') {
      throw new Error('Phrase de confirmation incorrecte');
    }

    // Get all auction IDs for this phase
    const { data: auctions, error: auctionsError } = await supabaseClient
      .from('auctions')
      .select('id')
      .eq('phase_id', phase_id);

    if (auctionsError) throw auctionsError;

    const auctionIds = auctions?.map(a => a.id) || [];

    if (auctionIds.length === 0) {
      throw new Error('Aucune enchère trouvée pour cette phase');
    }

    // Delete annonces
    const { error: deleteAnnoncesError } = await supabaseClient
      .from('annonces')
      .delete()
      .in('auction_id', auctionIds);

    if (deleteAnnoncesError) throw deleteAnnoncesError;

    // Delete bids
    const { error: deleteBidsError } = await supabaseClient
      .from('bids')
      .delete()
      .in('auction_id', auctionIds);

    if (deleteBidsError) throw deleteBidsError;

    // Delete auctions
    const { error: deleteAuctionsError, count: deletedAuctions } = await supabaseClient
      .from('auctions')
      .delete({ count: 'exact' })
      .eq('phase_id', phase_id);

    if (deleteAuctionsError) throw deleteAuctionsError;

    // Get manager ID for audit log
    const { data: manager } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Log audit
    if (manager) {
      await supabaseClient.from('audits').insert({
        actor_manager_id: manager.id,
        action: 'admin_reset_phase_auctions',
        payload_json: JSON.stringify({
          phase_id,
          auctions_deleted: deletedAuctions || 0,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        phase_id,
        auctions_deleted: deletedAuctions || 0,
        message: `Toutes les enchères de la phase ont été supprimées (${deletedAuctions || 0} rounds)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
