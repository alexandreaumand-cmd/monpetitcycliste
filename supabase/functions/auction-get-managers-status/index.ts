import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface ManagerStatus {
  manager_id: string;
  manager_nom: string;
  current_round_riders: number;
  current_round_budget: number;
  previous_rounds_riders: number;
  previous_rounds_budget: number;
  slots_missing: number;
  max_slots: number;
  budget_total: number;
  last_activity: string | null;
  riders_per_round: number[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Client service role pour bypasser RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Client anon pour vérifier l'authentification utilisateur
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { auction_id, phase_id } = await req.json();

    if (!auction_id || !phase_id) {
      throw new Error('Missing auction_id or phase_id');
    }

    console.log(`Fetching manager statuses for auction ${auction_id}, phase ${phase_id}`);

    // Récupérer le league_id depuis l'auction (via admin pour bypasser RLS)
    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('league_id')
      .eq('id', auction_id)
      .single();

    if (auctionError) {
      console.error('Error fetching auction:', auctionError);
      throw auctionError;
    }

    console.log(`Auction league_id: ${auction.league_id}`);

    // Vérifier que l'utilisateur est membre de cette ligue
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('league_members')
      .select('id')
      .eq('league_id', auction.league_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !userMembership) {
      console.error('User is not a member of this league');
      return new Response(
        JSON.stringify({ error: 'Access denied - not a member of this league' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer les informations de la ligue (settings)
    const { data: league, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .select('settings')
      .eq('id', auction.league_id)
      .single();

    if (leagueError) {
      console.error('Error fetching league:', leagueError);
      throw leagueError;
    }

    // Extraire budget et max_riders depuis settings
    const budgetPerManager = Number(league.settings?.budget ?? 2200);
    let maxRidersPerManager = Number(league.settings?.max_riders ?? null);

    // Fallback sur phases.max_coureurs si maxRidersPerManager est null
    if (!maxRidersPerManager) {
      const { data: phase, error: phaseError } = await supabaseAdmin
        .from('phases')
        .select('max_coureurs')
        .eq('id', phase_id)
        .single();
      
      if (phaseError) {
        console.error('Error fetching phase:', phaseError);
      }
      
      maxRidersPerManager = Number(phase?.max_coureurs ?? 30);
    }

    console.log(`League budget: ${budgetPerManager}, max riders: ${maxRidersPerManager}`);

    // Récupérer uniquement les managers membres de cette ligue
    const { data: leagueMembers, error: membersError } = await supabaseAdmin
      .from('league_members')
      .select('user_id')
      .eq('league_id', auction.league_id);

    if (membersError) {
      console.error('Error fetching league members:', membersError);
      throw membersError;
    }

    console.log(`Found ${leagueMembers?.length || 0} league members`);

    // Si aucun membre, retourner un tableau vide
    if (!leagueMembers || leagueMembers.length === 0) {
      console.log('No members found for this league');
      return new Response(
        JSON.stringify({ managers: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userIds = leagueMembers.map(m => m.user_id);

    const { data: managers, error: managersError } = await supabaseAdmin
      .from('managers')
      .select('id, nom, user_id')
      .in('user_id', userIds)
      .order('nom');

    if (managersError) {
      console.error('Error fetching managers:', managersError);
      throw managersError;
    }

    console.log(`Found ${managers?.length || 0} managers for league ${auction.league_id}`);

    // Pour chaque manager, calculer son statut
    const managerStatuses: ManagerStatus[] = await Promise.all(
      managers.map(async (manager) => {
        // Récupérer tous les rosters avec leur auction_id
        const { count: rosterCount, data: rosterWithDates, error: rosterError } = await supabaseAdmin
          .from('rosters')
          .select('prix_signature, auction_id', { count: 'exact' })
          .eq('manager_id', manager.id)
          .eq('phase_id', phase_id)
          .or(`league_id.eq.${auction.league_id},league_id.is.null`);

        if (rosterError) {
          console.error(`Error counting roster for manager ${manager.nom}:`, rosterError);
        }

        // Séparer les coureurs du tour actuel vs tours précédents
        let current_round_riders = 0;
        let current_round_budget = 0;
        let previous_rounds_riders = 0;
        let previous_rounds_budget = 0;

        const ridersPerRoundMap: { [round: number]: number } = {};
        const auctionIds = [...new Set(rosterWithDates?.map(r => r.auction_id).filter(Boolean) || [])];

        if (auctionIds.length > 0) {
          const { data: auctionsData } = await supabaseAdmin
            .from('auctions')
            .select('id, round_number')
            .in('id', auctionIds);
          
          const auctionRoundMap = new Map(
            auctionsData?.map(a => [a.id, a.round_number]) || []
          );
          
          rosterWithDates?.forEach(roster => {
            const price = Number(roster.prix_signature || 0);
            
            if (roster.auction_id === auction_id) {
              current_round_riders += 1;
              current_round_budget += price;
            } else {
              previous_rounds_riders += 1;
              previous_rounds_budget += price;
            }

            if (roster.auction_id) {
              const round = auctionRoundMap.get(roster.auction_id);
              if (round !== undefined) {
                ridersPerRoundMap[round] = (ridersPerRoundMap[round] || 0) + 1;
              }
            }
          });
        }

        const maxRound = Math.max(...Object.keys(ridersPerRoundMap).map(Number), 0);
        const riders_per_round = Array.from({ length: maxRound + 1 }, (_, i) => ridersPerRoundMap[i] || 0);

        const totalRiderCount = rosterCount || 0;
        const slots_missing = maxRidersPerManager - totalRiderCount;

        // Calculer la dernière activité depuis les bids uniquement
        const { data: lastBid } = await supabaseAdmin
          .from('bids')
          .select('updated_at')
          .eq('manager_id', manager.id)
          .or(`league_id.eq.${auction.league_id},league_id.is.null`)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastActivity = lastBid?.updated_at || null;

        return {
          manager_id: manager.id,
          manager_nom: manager.nom,
          current_round_riders,
          current_round_budget: Math.round(current_round_budget),
          previous_rounds_riders,
          previous_rounds_budget: Math.round(previous_rounds_budget),
          slots_missing,
          max_slots: maxRidersPerManager,
          budget_total: budgetPerManager,
          last_activity: lastActivity,
          riders_per_round,
        };
      })
    );

    // Trier par slots_missing DESC (plus incomplet en premier), puis par nom
    const sortedStatuses = managerStatuses.sort((a, b) => {
      if (b.slots_missing !== a.slots_missing) {
        return b.slots_missing - a.slots_missing;
      }
      return a.manager_nom.localeCompare(b.manager_nom);
    });

    console.log(`Found ${sortedStatuses.length} managers with statuses`);

    return new Response(
      JSON.stringify({ managers: sortedStatuses }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in auction-get-managers-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
