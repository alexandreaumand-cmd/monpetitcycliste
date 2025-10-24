import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { auction_id, phase_id, league_id } = await req.json();

    if (!league_id) {
      return new Response(JSON.stringify({ error: 'league_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get manager
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      return new Response(JSON.stringify({ error: 'Manager not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auction details
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auction_id)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Auction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all annonces for this auction
    const { data: allAnnonces } = await supabase
      .from('annonces')
      .select('*, coureurs(*), managers:winning_manager_id(*)')
      .eq('auction_id', auction_id)
      .order('published_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    const total_annonces = allAnnonces?.length || 0;
    const published_annonces = allAnnonces?.filter(a => a.published) || [];
    const published_count = published_annonces.length;
    const unpublished_count = total_annonces - published_count;

    // Format annonces with is_my_win flag
    const annonces = published_annonces.map(a => ({
      id: a.id,
      type: a.type,
      coureur: a.coureurs ? {
        id: a.coureur_id,
        nom: a.coureurs.nom,
        equipe: a.coureurs.equipe,
      } : null,
      winning_manager: a.managers ? {
        id: a.winning_manager_id,
        nom: a.managers.nom,
      } : null,
      winning_amount: a.winning_amount,
      losers: a.losers_json || [],
      is_my_win: a.winning_manager_id === manager.id,
      published_at: a.published_at,
    }));

    // Get my new riders from this auction (rosters added during this round)
    const { data: newRiders } = await supabase
      .from('rosters')
      .select('coureur_id, prix_signature, coureurs(id, nom, equipe)')
      .eq('phase_id', phase_id)
      .eq('manager_id', manager.id)
      .eq('league_id', league_id)
      .in('coureur_id', annonces.filter(a => a.is_my_win).map(a => a.coureur?.id).filter(Boolean));

    const my_new_riders = (newRiders || []).map(r => {
      const coureur = Array.isArray(r.coureurs) ? r.coureurs[0] : r.coureurs;
      return {
        coureur_id: r.coureur_id,
        nom: coureur?.nom || '',
        equipe: coureur?.equipe || '',
        prix_signature: r.prix_signature,
      };
    });

    return new Response(
      JSON.stringify({
        auction: {
          id: auction.id,
          round_number: auction.round_number,
          statut: auction.statut,
          closed_at: auction.closed_at,
        },
        total_annonces,
        published_count,
        unpublished_count,
        annonces,
        my_new_riders,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-get-live-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
