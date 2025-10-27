import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface ManagerStatus {
  nom: string;
  status: 'validated' | 'pending' | 'incomplete';
  slots_filled: number;
  max_slots: number;
  budget_used: number;
  total_budget: number;
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
        // Compter les coureurs dans le roster (filtré par league_id avec compatibilité historique)
        const { count: rosterCount, error: rosterError } = await supabaseAdmin
          .from('rosters')
          .select('*', { count: 'exact', head: true })
          .eq('manager_id', manager.id)
          .eq('phase_id', phase_id)
          .or(`league_id.eq.${auction.league_id},league_id.is.null`);

        if (rosterError) {
          console.error(`Error counting roster for manager ${manager.nom}:`, rosterError);
        }

        // Calculer le budget dépensé (rosters filtré par league_id avec compatibilité historique)
        const { data: rosterData, error: rosterBudgetError } = await supabaseAdmin
          .from('rosters')
          .select('prix_signature')
          .eq('manager_id', manager.id)
          .eq('phase_id', phase_id)
          .or(`league_id.eq.${auction.league_id},league_id.is.null`);

        if (rosterBudgetError) {
          console.error(`Error fetching roster budget for manager ${manager.nom}:`, rosterBudgetError);
        }

        const budgetSpent = rosterData?.reduce((sum, r) => sum + Number(r.prix_signature || 0), 0) || 0;

        // CRITICAL: Compter les enchères filtré par auction_id ET league_id (avec compatibilité historique)
        const { data: bids, error: bidsError } = await supabaseAdmin
          .from('bids')
          .select('statut, montant')
          .eq('manager_id', manager.id)
          .eq('auction_id', auction_id)
          .or(`league_id.eq.${auction.league_id},league_id.is.null`);

        if (bidsError) {
          console.error(`Error fetching bids for manager ${manager.nom}:`, bidsError);
        }

        const draftCount = bids?.filter(b => b.statut === 'draft').length || 0;
        const pendingCount = bids?.filter(b => b.statut === 'pending').length || 0;
        const draftSum = bids?.filter(b => b.statut === 'draft').reduce((sum, b) => sum + Number(b.montant || 0), 0) || 0;
        const pendingSum = bids?.filter(b => b.statut === 'pending').reduce((sum, b) => sum + Number(b.montant || 0), 0) || 0;

        const totalRosterCount = rosterCount || 0;
        const slotsFilled = totalRosterCount + draftCount + pendingCount;
        const budgetUsed = budgetSpent + draftSum + pendingSum;

        // Déterminer le statut
        let status: 'validated' | 'pending' | 'incomplete';
        
        // Cas 1: A soumis des enchères pour ce tour
        if (pendingCount > 0) {
          status = 'validated';
        }
        // Cas 2: Roster complet ET pas d'enchères en draft
        // → N'a plus besoin de participer aux enchères
        else if (slotsFilled >= maxRidersPerManager && draftCount === 0) {
          status = 'validated';
        }
        // Cas 3: Roster incomplet
        else if (slotsFilled < maxRidersPerManager) {
          status = 'incomplete';
        }
        // Cas 4: A des drafts mais n'a pas encore validé
        else {
          status = 'pending';
        }

        return {
          nom: manager.nom,
          status,
          slots_filled: slotsFilled,
          max_slots: maxRidersPerManager,
          budget_used: Math.round(budgetUsed),
          total_budget: budgetPerManager,
        };
      })
    );

    // Trier par statut (incomplete > pending > validated)
    const sortedStatuses = managerStatuses.sort((a, b) => {
      const statusOrder = { incomplete: 0, pending: 1, validated: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.nom.localeCompare(b.nom);
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
