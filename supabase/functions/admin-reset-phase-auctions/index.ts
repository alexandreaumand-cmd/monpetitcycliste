import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[admin-reset-phase-auctions] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Non authentifié - en-tête Authorization manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for auth verification
    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Create service role client for admin operations (bypass RLS)
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAuthClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[admin-reset-phase-auctions] Authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Non authentifié - token invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-reset-phase-auctions] User authenticated: ${user.id}`);

    // Parse request body
    const { phase_id, confirm_phrase, league_id } = await req.json();

    // Validate league_id
    if (!league_id) {
      console.error('[admin-reset-phase-auctions] Missing league_id');
      return new Response(
        JSON.stringify({ error: 'league_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check superadmin status
    const { data: isSuperAdmin, error: adminError } = await supabaseAuthClient.rpc('is_superadmin');
    
    if (adminError) {
      console.error('[admin-reset-phase-auctions] Error checking superadmin status:', adminError);
    }

    console.log(`[admin-reset-phase-auctions] User ${user.id} isSuperAdmin: ${isSuperAdmin}`);

    // Check league admin access (skip if superadmin)
    if (!isSuperAdmin) {
      const { data: isLeagueAdmin, error: adminCheckError } = await supabaseAuthClient.rpc('is_league_admin', {
        l_id: league_id
      });

      console.log(`[admin-reset-phase-auctions] User ${user.id} isLeagueAdmin for ${league_id}: ${isLeagueAdmin}`);

      if (adminCheckError) {
        console.error('[admin-reset-phase-auctions] Error checking league admin status:', adminCheckError);
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la vérification des permissions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isLeagueAdmin) {
        console.error(`[admin-reset-phase-auctions] Access denied for user ${user.id} on league ${league_id}`);
        return new Response(
          JSON.stringify({ error: 'Accès refusé: vous devez être superadmin ou admin de cette ligue' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify confirmation phrase
    if (confirm_phrase !== 'RESET ENCHERES') {
      console.error('[admin-reset-phase-auctions] Invalid confirmation phrase');
      return new Response(
        JSON.stringify({ error: 'Phrase de confirmation incorrecte' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-reset-phase-auctions] Starting reset for phase ${phase_id} in league ${league_id}`);

    // Get all auction IDs for this phase (use admin client to bypass RLS)
    const { data: auctions, error: auctionsError } = await supabaseAdminClient
      .from('auctions')
      .select('id')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id);

    if (auctionsError) {
      console.error('[admin-reset-phase-auctions] Error fetching auctions:', auctionsError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des enchères' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const auctionIds = auctions?.map((a: { id: string }) => a.id) || [];

    if (auctionIds.length === 0) {
      console.log('[admin-reset-phase-auctions] No auctions found for this phase');
      return new Response(
        JSON.stringify({
          success: true,
          phase_id,
          league_id,
          auctions_deleted: 0,
          message: 'Aucune enchère trouvée pour cette phase. Rien à supprimer.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-reset-phase-auctions] Found ${auctionIds.length} auctions to delete`);

    // Delete annonces (use admin client to bypass RLS)
    const { error: deleteAnnoncesError } = await supabaseAdminClient
      .from('annonces')
      .delete()
      .in('auction_id', auctionIds);

    if (deleteAnnoncesError) {
      console.error('[admin-reset-phase-auctions] Error deleting annonces:', deleteAnnoncesError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la suppression des annonces' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-reset-phase-auctions] Annonces deleted');

    // Delete bids (use admin client to bypass RLS)
    const { error: deleteBidsError } = await supabaseAdminClient
      .from('bids')
      .delete()
      .in('auction_id', auctionIds)
      .eq('league_id', league_id);

    if (deleteBidsError) {
      console.error('[admin-reset-phase-auctions] Error deleting bids:', deleteBidsError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la suppression des enchères' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-reset-phase-auctions] Bids deleted');

    // Delete auctions (use admin client to bypass RLS)
    const { error: deleteAuctionsError, count: deletedAuctions } = await supabaseAdminClient
      .from('auctions')
      .delete({ count: 'exact' })
      .eq('phase_id', phase_id)
      .eq('league_id', league_id);

    if (deleteAuctionsError) {
      console.error('[admin-reset-phase-auctions] Error deleting auctions:', deleteAuctionsError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la suppression des rounds' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-reset-phase-auctions] ${deletedAuctions} auctions deleted`);

    // Get manager ID for audit log (use admin client)
    const { data: manager } = await supabaseAdminClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Log audit
    if (manager) {
      await supabaseAdminClient.from('audits').insert({
        actor_manager_id: manager.id,
        action: 'admin_reset_phase_auctions',
        payload_json: JSON.stringify({
          phase_id,
          league_id,
          auctions_deleted: deletedAuctions || 0,
        }),
      });
      console.log('[admin-reset-phase-auctions] Audit log created');
    }

    console.log(`[admin-reset-phase-auctions] Reset completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        phase_id,
        league_id,
        auctions_deleted: deletedAuctions || 0,
        message: `Toutes les enchères de la phase ont été supprimées (${deletedAuctions || 0} rounds)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[admin-reset-phase-auctions] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
