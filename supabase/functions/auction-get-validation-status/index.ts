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

    const { phase_id, league_id } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get active auction - filter by league_id if provided
    let auctionQuery = supabase
      .from('auctions')
      .select('id, round_number, deadline_at, league_id')
      .eq('phase_id', phase_id)
      .eq('statut', 'open')
      .order('round_number', { ascending: false })
      .limit(1);
    
    if (league_id) {
      auctionQuery = auctionQuery.eq('league_id', league_id);
    }
    
    const { data: auction } = await auctionQuery.single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Aucune enchère active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leagueId = auction.league_id;

    // Get all league members with their roster status
    let eligibleManagerIds: string[] = [];
    let eligibleManagerNames: string[] = [];
    let totalEligibleManagers = 0;

    if (leagueId) {
      // Step 1: Get league configuration from settings
      const { data: league } = await supabase
        .from('leagues')
        .select('settings')
        .eq('id', leagueId)
        .single();

      let maxCoureurs: number = league?.settings?.max_riders ? Number(league.settings.max_riders) : 0;
      
      // Fallback to phase max_coureurs if not set in league settings
      if (!maxCoureurs) {
        const { data: phase } = await supabase
          .from('phases')
          .select('max_coureurs')
          .eq('id', phase_id)
          .single();
        
        maxCoureurs = phase?.max_coureurs ?? 30;
      }
      
      console.log(`📋 League ${leagueId}: maxCoureurs = ${maxCoureurs}`);

      // Step 2: Get all league members' user_ids
      const { data: members } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);

      const memberUserIds = (members || []).map(m => m.user_id);
      
      console.log(`📋 Found ${memberUserIds.length} league members`);

      // Step 3: Get all managers for these user_ids
      const { data: managersRows } = await supabase
        .from('managers')
        .select('id, nom, user_id')
        .in('user_id', memberUserIds);

      console.log(`👥 Found ${managersRows?.length || 0} managers`);

      // Step 4: For each manager, count their rosters
      for (const m of managersRows || []) {
      const { count } = await supabase
        .from('rosters')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', m.id)
        .eq('phase_id', phase_id)
        .eq('league_id', leagueId);

        const rosterCount = count || 0;
        const slotsRestants = maxCoureurs - rosterCount;
        
        if (slotsRestants > 0) {
          eligibleManagerIds.push(m.id);
          eligibleManagerNames.push(m.nom);
        }
        
        console.log(`📊 ${m.nom}: ${rosterCount}/${maxCoureurs} coureurs (${slotsRestants} restants)`);
      }

      totalEligibleManagers = eligibleManagerIds.length;
      console.log(`✅ Total eligible managers: ${totalEligibleManagers}`);
    } else {
      // Fallback for legacy mode (no league)
      const { data: incompleteRosters } = await supabase
        .from('managers_rosters_status')
        .select('manager_id, manager_nom, slots_restants')
        .eq('phase_id', phase_id)
        .gt('slots_restants', 0);
      
      if (incompleteRosters && incompleteRosters.length > 0) {
        eligibleManagerIds = incompleteRosters.map((r: any) => r.manager_id);
        eligibleManagerNames = incompleteRosters.map((r: any) => r.manager_nom);
        totalEligibleManagers = incompleteRosters.length;
      }
    }

    // CRITICAL: Get managers with pending bids filtered by league_id
    const { data: validatedManagers } = await supabase
      .from('bids')
      .select(`
        manager_id,
        managers!inner(nom)
      `)
      .eq('auction_id', auction.id)
      .eq('league_id', leagueId)
      .eq('statut', 'pending')
      .in('manager_id', eligibleManagerIds);

    // Extract unique validated manager names
    const validatedNames = [...new Set(
      (validatedManagers || []).map((b: any) => b.managers.nom)
    )];

    // Waiting managers = eligible managers minus those who validated
    const waitingNames = eligibleManagerNames.filter(
      name => !validatedNames.includes(name)
    );

    const totalManagers = totalEligibleManagers;

    console.log('📊 Validation status:', {
      phase_id,
      league_id: leagueId,
      auction_id: auction.id,
      total_eligible: totalEligibleManagers,
      validated: validatedNames.length,
      waiting: waitingNames.length,
      eligible_managers: eligibleManagerNames,
      validated_managers: validatedNames,
      waiting_managers: waitingNames
    });

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
