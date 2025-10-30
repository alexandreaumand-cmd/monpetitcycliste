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

    // Get auction details with saison_id
    const { data: auction } = await supabase
      .from('auctions')
      .select('*, phases!inner(saison_id)')
      .eq('id', auction_id)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Auction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const saison_id = (auction.phases as any)?.saison_id;

    // Get all annonces for this auction - sorted by winning amount (highest first)
    const { data: allAnnonces } = await supabase
      .from('annonces')
      .select('coureur_id, winning_manager_id, id, type, winning_amount, losers_json, published, published_at, managers:winning_manager_id(id, nom)')
      .eq('auction_id', auction_id)
      .order('winning_amount', { ascending: false, nullsFirst: false });

    const total_annonces = allAnnonces?.length || 0;
    const published_annonces = allAnnonces?.filter(a => a.published) || [];
    const published_count = published_annonces.length;
    const unpublished_count = total_annonces - published_count;

    // Get coureurs info from coureurs_saisons + equipes_saisons
    const coureurIds = published_annonces.map(a => a.coureur_id).filter(Boolean);
    const coureursMap = new Map();

    if (coureurIds.length > 0 && saison_id) {
      for (const coureurId of coureurIds) {
        const { data: coureurData } = await supabase
          .from('coureurs_saisons')
          .select('coureur_id, coureurs!inner(id, nom), equipe_id')
          .eq('saison_id', saison_id)
          .eq('coureur_id', coureurId)
          .limit(1);

        if (coureurData && coureurData.length > 0) {
          const cs = coureurData[0];
          const coureurInfo = cs.coureurs as any;
          
          // Fetch equipe name
          let equipeName = '';
          if (cs.equipe_id) {
            const { data: equipeData } = await supabase
              .from('equipes_saisons')
              .select('nom_affiche')
              .eq('id', cs.equipe_id)
              .limit(1);
            equipeName = equipeData?.[0]?.nom_affiche || '';
          }
          
          coureursMap.set(coureurId, {
            id: coureurInfo?.id || cs.coureur_id,
            nom: coureurInfo?.nom || '',
            equipe: equipeName
          });
        }
      }
    }

    // Format annonces with is_my_win flag
    const annonces = published_annonces.map(a => {
      const coureur = coureursMap.get(a.coureur_id);
      return {
        id: a.id,
        type: a.type,
        coureur: coureur ? {
          id: a.coureur_id,
          nom: coureur.nom,
          equipe: coureur.equipe,
        } : null,
        winning_manager: a.managers ? {
          id: a.winning_manager_id,
          nom: (a.managers as any).nom,
        } : null,
        winning_amount: a.winning_amount,
        losers: a.losers_json || [],
        is_my_win: a.winning_manager_id === manager.id,
        published_at: a.published_at,
      };
    });

    // Get my new riders from this auction
    const myWinningCoureurIds = annonces
      .filter(a => a.is_my_win)
      .map(a => a.coureur?.id)
      .filter(Boolean);

    const my_new_riders = [];
    if (myWinningCoureurIds.length > 0) {
      const { data: newRiders } = await supabase
        .from('rosters')
        .select('coureur_id, prix_signature')
        .eq('phase_id', phase_id)
        .eq('manager_id', manager.id)
        .eq('league_id', league_id)
        .in('coureur_id', myWinningCoureurIds);

      for (const r of (newRiders || [])) {
        const coureur = coureursMap.get(r.coureur_id);
        if (coureur) {
          my_new_riders.push({
            coureur_id: r.coureur_id,
            nom: coureur.nom,
            equipe: coureur.equipe,
            prix_signature: r.prix_signature,
          });
        }
      }
    }

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
