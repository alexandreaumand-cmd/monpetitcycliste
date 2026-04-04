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

    const { phase_id, league_id, auction_id } = await req.json();

    console.log('[auction-get-validation-status] Request body:', { auction_id, league_id, phase_id });

    if (!phase_id && !auction_id) {
      console.log('[auction-get-validation-status] Missing phase_id and auction_id');
      return new Response(JSON.stringify({ error: 'phase_id or auction_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let auction;

    // If auction_id is provided, use it directly (more reliable)
    if (auction_id) {
      const { data } = await supabase
        .from('auctions')
        .select('id, round_number, deadline_at, league_id, phase_id')
        .eq('id', auction_id)
        .single();
      
      auction = data;
    } else {
      // Otherwise, find the active auction for the phase
      let auctionQuery = supabase
        .from('auctions')
        .select('id, round_number, deadline_at, league_id, phase_id')
        .eq('phase_id', phase_id)
        .eq('statut', 'open')
        .order('round_number', { ascending: false })
        .limit(1);
      
      if (league_id) {
        auctionQuery = auctionQuery.eq('league_id', league_id);
      }
      
      const { data } = await auctionQuery.single();
      auction = data;
    }

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Aucune enchère trouvée' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leagueId = auction.league_id;
    let phaseId = auction.phase_id;

    // Fallback: if auction has no phase_id, use current active phase
    if (!phaseId) {
      const { data: activePhase } = await supabase
        .from('phases')
        .select('id')
        .eq('statut', 'active')
        .order('date_debut', { ascending: false })
        .limit(1)
        .single();
      phaseId = activePhase?.id ?? null;
      console.log(`⚠️ auction ${auction.id} has no phase_id, fallback to active phase: ${phaseId}`);
    }

    // Get all league members with their roster status
    let eligibleManagerIds: string[] = [];
    let eligibleManagers: Array<{ manager_id: string; manager_nom: string }> = [];

    if (leagueId) {
      // Step 1: Get league configuration from settings
      const { data: league } = await supabase
        .from('leagues')
        .select('settings')
        .eq('id', leagueId)
        .single();

      let maxCoureurs: number = league?.settings?.max_riders ? Number(league.settings.max_riders) : 0;
      
      // Fallback to phase max_coureurs if not set in league settings
      if (!maxCoureurs && phaseId) {
        const { data: phase } = await supabase
          .from('phases')
          .select('max_coureurs')
          .eq('id', phaseId)
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
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId);

        const rosterCount = count || 0;
        const slotsRestants = maxCoureurs - rosterCount;
        
        if (slotsRestants > 0) {
          eligibleManagerIds.push(m.id);
          eligibleManagers.push({
            manager_id: m.id,
            manager_nom: m.nom
          });
        }
        
        console.log(`📊 ${m.nom}: ${rosterCount}/${maxCoureurs} coureurs (${slotsRestants} restants)`);
      }

      console.log(`✅ Total eligible managers: ${eligibleManagers.length}`);
    } else {
      // Fallback for legacy mode (no league)
      const { data: incompleteRosters } = await supabase
        .from('managers_rosters_status')
        .select('manager_id, manager_nom, slots_restants')
        .eq('phase_id', phaseId)
        .gt('slots_restants', 0);
      
      if (incompleteRosters && incompleteRosters.length > 0) {
        eligibleManagerIds = incompleteRosters.map((r: any) => r.manager_id);
        eligibleManagers = incompleteRosters.map((r: any) => ({
          manager_id: r.manager_id,
          manager_nom: r.manager_nom
        }));
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

    // Build validated managers array with full objects
    const validatedManagersArray: Array<{ manager_id: string; manager_nom: string }> = [];
    const validatedManagerIds: string[] = [];
    
    (validatedManagers || []).forEach((b: any) => {
      if (!validatedManagerIds.includes(b.manager_id)) {
        validatedManagerIds.push(b.manager_id);
        validatedManagersArray.push({
          manager_id: b.manager_id,
          manager_nom: b.managers.nom
        });
      }
    });

    // Waiting managers = eligible managers minus those who validated
    const waitingManagersArray = eligibleManagers.filter(
      eligible => !validatedManagerIds.includes(eligible.manager_id)
    );

    const totalManagers = eligibleManagers.length;

    console.log('📊 Validation status:', {
      phase_id: phaseId,
      league_id: leagueId,
      auction_id: auction.id,
      total_eligible: totalManagers,
      validated: validatedManagersArray.length,
      waiting: waitingManagersArray.length,
      eligible_managers: eligibleManagers.map(m => m.manager_nom),
      validated_managers: validatedManagersArray.map(m => m.manager_nom),
      waiting_managers: waitingManagersArray.map(m => m.manager_nom)
    });

    return new Response(
      JSON.stringify({
        auction_id: auction.id,
        round_number: auction.round_number,
        deadline_at: auction.deadline_at,
        validated_count: validatedManagersArray.length,
        waiting_count: waitingManagersArray.length,
        total_managers: totalManagers,
        validated_managers: validatedManagersArray
          .sort((a, b) => a.manager_nom.localeCompare(b.manager_nom)),
        waiting_managers: waitingManagersArray
          .sort((a, b) => a.manager_nom.localeCompare(b.manager_nom)),
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
