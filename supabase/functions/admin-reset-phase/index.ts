import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
    )

    // Vérifier l'authentification
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vérifier que l'utilisateur est superadmin
    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin')
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: superadmin requis' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { phase_id, confirmation_phrase } = await req.json()

    // Vérifier que la phrase de confirmation commence par "RESET PHASE"
    if (!confirmation_phrase || !confirmation_phrase.startsWith('RESET PHASE')) {
      return new Response(JSON.stringify({ error: 'Phrase de confirmation incorrecte ou manquante' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('🗑️ Starting phase reset for:', phase_id)

    // 1. Supprimer les rosters
    const { count: rostersDeleted } = await supabaseClient
      .from('rosters')
      .delete({ count: 'exact' })
      .eq('phase_id', phase_id)

    console.log(`✅ Deleted ${rostersDeleted} rosters`)

    // 2. Récupérer les IDs des auctions de cette phase
    const { data: auctions } = await supabaseClient
      .from('auctions')
      .select('id')
      .eq('phase_id', phase_id)

    const auctionIds = auctions?.map(a => a.id) || []
    console.log(`Found ${auctionIds.length} auctions to clean`)

    // 3. Supprimer les annonces
    let annoncesDeleted = 0
    if (auctionIds.length > 0) {
      const { count } = await supabaseClient
        .from('annonces')
        .delete({ count: 'exact' })
        .in('auction_id', auctionIds)
      annoncesDeleted = count || 0
      console.log(`✅ Deleted ${annoncesDeleted} annonces`)
    }

    // 4. Supprimer les bids
    let bidsDeleted = 0
    if (auctionIds.length > 0) {
      const { count } = await supabaseClient
        .from('bids')
        .delete({ count: 'exact' })
        .in('auction_id', auctionIds)
      bidsDeleted = count || 0
      console.log(`✅ Deleted ${bidsDeleted} bids`)
    }

    // 5. Supprimer les auctions
    const { count: auctionsDeleted } = await supabaseClient
      .from('auctions')
      .delete({ count: 'exact' })
      .eq('phase_id', phase_id)

    console.log(`✅ Deleted ${auctionsDeleted} auctions`)

    console.log('✅ Phase reset complete')

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          rosters: rostersDeleted || 0,
          annonces: annoncesDeleted,
          bids: bidsDeleted,
          auctions: auctionsDeleted || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
