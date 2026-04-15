import { createClient } from 'npm:@supabase/supabase-js@2';
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

    // Get auction details with saison_id + pause state
    const { data: auction } = await supabase
      .from('auctions')
      .select('*, phases!phase_id(saison_id), paused_manager:announcements_paused_by(id, nom)')
      .eq('id', auction_id)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Auction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const saison_id = (auction.phases as any)?.saison_id;

    // Get all annonces for this auction - sorted by published_at (most recent first)
    const now = new Date().toISOString();

    const { data: allAnnonces } = await supabase
      .from('annonces')
      .select('coureur_id, winning_manager_id, id, type, winning_amount, losers_json, published, published_at, managers:winning_manager_id(id, nom)')
      .eq('auction_id', auction_id)
      .eq('published', true)
      .lte('published_at', now)
      .order('published_at', { ascending: false });

    // Get total annonces count (including not yet visible ones)
    const { count: totalAnnonceCount } = await supabase
      .from('annonces')
      .select('id', { count: 'exact', head: true })
      .eq('auction_id', auction_id)
      .eq('published', true);

    const total_annonces = totalAnnonceCount || 0;
    const published_annonces = allAnnonces || [];
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

    // Get all league managers
    const { data: leagueManagers } = await supabase
      .from('managers')
      .select('id, nom')
      .in('id', 
        (await supabase
          .from('league_members')
          .select('user_id')
          .eq('league_id', league_id)
          .then(({ data }) => data?.map(m => m.user_id) || [])
        ).length > 0 
          ? (await supabase
              .from('managers')
              .select('id')
              .in('user_id', 
                (await supabase
                  .from('league_members')
                  .select('user_id')
                  .eq('league_id', league_id)
                ).data?.map(m => m.user_id) || []
              )
            ).data?.map(m => m.id) || []
          : []
      );

    // Get all league members directly for cleaner query
    const { data: leagueMembersData } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league_id);

    const userIds = leagueMembersData?.map(m => m.user_id) || [];
    
    const { data: allLeagueManagers } = await supabase
      .from('managers')
      .select('id, nom')
      .in('user_id', userIds);

    // Build managers recruits map from annonces
    const managersRecruitsMap = new Map<string, { manager_id: string; manager_nom: string; recruits: any[] }>();

    // Initialize all managers with empty recruits
    for (const mgr of (allLeagueManagers || [])) {
      managersRecruitsMap.set(mgr.id, {
        manager_id: mgr.id,
        manager_nom: mgr.nom,
        recruits: []
      });
    }

    // Fill recruits from annonces
    for (const annonce of annonces) {
      if (annonce.type === 'gain' && annonce.winning_manager?.id) {
        const mgrData = managersRecruitsMap.get(annonce.winning_manager.id);
        if (mgrData) {
          mgrData.recruits.push({
            coureur_id: annonce.coureur?.id,
            nom: annonce.coureur?.nom,
            equipe: annonce.coureur?.equipe,
            prix_signature: annonce.winning_amount,
          });
        }
      }
    }

    // Separate my recruits from others
    const my_new_riders = managersRecruitsMap.get(manager.id)?.recruits || [];
    
    // Get other managers' data (excluding current manager)
    const all_managers_recruits = Array.from(managersRecruitsMap.values())
      .filter(m => m.manager_id !== manager.id)
      .sort((a, b) => b.recruits.length - a.recruits.length);

    // Find the most recently announced winner (for highlighting)
    const latestAnnonce = annonces.length > 0 ? annonces[0] : null;
    const recently_announced_manager_id = latestAnnonce?.type === 'gain' 
      ? latestAnnonce.winning_manager?.id 
      : null;

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
        all_managers_recruits,
        recently_announced_manager_id,
        announcements_paused: auction.announcements_paused || false,
        announcements_paused_by_name: (auction.paused_manager as any)?.nom || null,
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
