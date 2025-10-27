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

    const { phase_id } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get active auction
    const { data: auction } = await supabase
      .from('auctions')
      .select('id, round_number, deadline_at')
      .eq('phase_id', phase_id)
      .eq('statut', 'open')
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Aucune enchère active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the league_id for this auction's phase
    const { data: phaseData } = await supabase
      .from('phases')
      .select('saison_id')
      .eq('id', phase_id)
      .single();

    let leagueId = null;
    if (phaseData?.saison_id) {
      const { data: auctionLeague } = await supabase
        .from('auctions')
        .select('league_id')
        .eq('id', auction.id)
        .single();
      
      leagueId = auctionLeague?.league_id;
    }

    // Get current league members if league_id exists
    let currentMemberUserIds: string[] = [];
    let totalLeagueMembers = 0;
    let allLeagueManagers: any[] = [];

    if (leagueId) {
      const { data: members } = await supabase
        .from('league_members')
        .select(`
          user_id,
          managers!inner(nom, user_id)
        `)
        .eq('league_id', leagueId);
      
      allLeagueManagers = members || [];
      currentMemberUserIds = allLeagueManagers.map(m => m.user_id);
      totalLeagueMembers = allLeagueManagers.length;
    }

    // Get managers with pending bids (validated)
    const { data: validatedManagers } = await supabase
      .from('bids')
      .select(`
        manager_id,
        managers!inner(nom, user_id)
      `)
      .eq('auction_id', auction.id)
      .eq('statut', 'pending');

    // Filter by league membership if applicable
    const filteredValidated = leagueId && currentMemberUserIds.length > 0
      ? (validatedManagers || []).filter((b: any) => currentMemberUserIds.includes(b.managers.user_id))
      : (validatedManagers || []);

    // Extract unique validated manager names
    const validatedNames = [...new Set(
      filteredValidated.map((b: any) => b.managers.nom)
    )];

    // Calculate waiting managers (all league members minus validated ones)
    let waitingNames: string[] = [];
    if (leagueId && allLeagueManagers.length > 0) {
      // Get all manager names from league
      const allManagerNames = allLeagueManagers.map((m: any) => m.managers.nom);
      // Remove those who have validated
      waitingNames = allManagerNames.filter(name => !validatedNames.includes(name));
    } else {
      // Fallback to old logic if no league
      const { data: waitingManagers } = await supabase
        .from('bids')
        .select(`
          manager_id,
          managers!inner(nom, user_id)
        `)
        .eq('auction_id', auction.id)
        .eq('statut', 'draft');

      waitingNames = [...new Set(
        (waitingManagers || []).map((b: any) => b.managers.nom)
      )];
    }

    const totalManagers = leagueId ? totalLeagueMembers : (validatedNames.length + waitingNames.length);

    return new Response(
      JSON.stringify({
        auction_id: auction.id,
        round_number: auction.round_number,
        deadline_at: auction.deadline_at,
        validated_count: validatedNames.length,
        waiting_count: waitingNames.length,
        total_managers: totalManagers,
        validated_managers: validatedNames.sort(),
        waiting_managers: waitingNames.sort(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-get-validation-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
