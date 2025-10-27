import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  console.log('🚀 [admin-reset-phase-auctions] Request received:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('📋 Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for DB operations (bypass RLS)
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseService.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Authenticated user:', user.id);

    // Parse request body
    const { phase_id, confirm_phrase, league_id } = await req.json();
    console.log('📦 Request params:', { phase_id, league_id, confirm_phrase_provided: !!confirm_phrase });

    // Validate required params
    if (!league_id) {
      console.error('❌ Missing league_id');
      return new Response(
        JSON.stringify({ error: 'league_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phase_id) {
      console.error('❌ Missing phase_id');
      return new Response(
        JSON.stringify({ error: 'phase_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with auth header for RPC calls (to use auth.uid())
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Check if user is superadmin
    const { data: isSuperAdmin, error: superAdminError } = await supabaseAuth.rpc('is_superadmin');
    console.log('🔐 isSuperAdmin:', isSuperAdmin, 'error:', superAdminError?.message);

    // Check if user is league admin
    const { data: isLeagueAdmin, error: leagueAdminError } = await supabaseAuth.rpc('is_league_admin', {
      l_id: league_id
    });
    console.log('🔐 isLeagueAdmin:', isLeagueAdmin, 'error:', leagueAdminError?.message);

    // Authorization check
    if (!isSuperAdmin && !isLeagueAdmin) {
      console.error('❌ User lacks permissions');
      return new Response(
        JSON.stringify({ error: 'Accès refusé: vous devez être superadmin ou admin de cette ligue' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authorized (superadmin or league admin)');

    // Confirmation phrase validation (skip for superadmins)
    if (!isSuperAdmin) {
      const normalizedPhrase = ((confirm_phrase ?? '').toString())
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      
      console.log('🔍 Normalized confirmation phrase:', normalizedPhrase);
      
      if (normalizedPhrase !== 'RESET ENCHERES') {
        console.error('❌ Invalid confirmation phrase for non-superadmin');
        return new Response(
          JSON.stringify({ error: 'Phrase de confirmation incorrecte. Veuillez taper exactement "RESET ENCHERES"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('✅ Confirmation phrase validated');
    } else {
      console.log('⏭️ Skipping confirmation phrase validation (superadmin)');
    }

    // Get all auction IDs for this phase and league
    const { data: auctions, error: auctionsError } = await supabaseService
      .from('auctions')
      .select('id')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id);

    if (auctionsError) {
      console.error('❌ Error fetching auctions:', auctionsError);
      return new Response(
        JSON.stringify({ error: `Erreur lors de la récupération des enchères: ${auctionsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const auctionIds = auctions?.map(a => a.id) || [];
    console.log(`📊 Found ${auctionIds.length} auctions to delete`);

    if (auctionIds.length === 0) {
      console.log('ℹ️ No auctions found for this phase/league');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Aucune enchère trouvée pour cette phase et ligue',
          auctions_deleted: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete annonces
    const { error: annoncesError, count: annoncesCount } = await supabaseService
      .from('annonces')
      .delete({ count: 'exact' })
      .in('auction_id', auctionIds);

    if (annoncesError) {
      console.error('❌ Error deleting annonces:', annoncesError);
      return new Response(
        JSON.stringify({ error: `Erreur lors de la suppression des annonces: ${annoncesError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`✅ Deleted ${annoncesCount || 0} annonces`);

    // Delete bids
    const { error: bidsError, count: bidsCount } = await supabaseService
      .from('bids')
      .delete({ count: 'exact' })
      .in('auction_id', auctionIds);

    if (bidsError) {
      console.error('❌ Error deleting bids:', bidsError);
      return new Response(
        JSON.stringify({ error: `Erreur lors de la suppression des mises: ${bidsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`✅ Deleted ${bidsCount || 0} bids`);

    // Delete auctions
    const { error: auctionsDeleteError, count: auctionsDeleteCount } = await supabaseService
      .from('auctions')
      .delete({ count: 'exact' })
      .in('id', auctionIds);

    if (auctionsDeleteError) {
      console.error('❌ Error deleting auctions:', auctionsDeleteError);
      return new Response(
        JSON.stringify({ error: `Erreur lors de la suppression des enchères: ${auctionsDeleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`✅ Deleted ${auctionsDeleteCount || 0} auctions`);

    // Get manager ID for audit log
    const { data: manager } = await supabaseService
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    console.log('👤 Manager ID for audit:', manager?.id);

    // Insert audit log
    const { error: auditError } = await supabaseService
      .from('audits')
      .insert({
        actor_manager_id: manager?.id,
        action: 'admin_reset_phase_auctions',
        payload_json: JSON.stringify({
          phase_id,
          league_id,
          auctions_deleted: auctionIds.length,
          annonces_deleted: annoncesCount || 0,
          bids_deleted: bidsCount || 0,
        }),
        created_at: new Date().toISOString(),
      });

    if (auditError) {
      console.warn('⚠️ Audit log failed (non-critical):', auditError.message);
    } else {
      console.log('✅ Audit log written');
    }

    const successMessage = `Suppression réussie : ${auctionIds.length} round(s), ${bidsCount || 0} mise(s), ${annoncesCount || 0} annonce(s)`;
    console.log('🎉 Success:', successMessage);

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage,
        auctions_deleted: auctionIds.length,
        bids_deleted: bidsCount || 0,
        annonces_deleted: annoncesCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: `Erreur serveur: ${message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
