// Version 2.1 - Fixed coureur lookup with separate queries
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phase_id, league_id } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!league_id) {
      return new Response(JSON.stringify({ error: 'league_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get manager_id
    const { data: manager } = await supabase
      .from('managers')
      .select('id, nom')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      return new Response(JSON.stringify({ error: 'Manager not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const manager_id = manager.id;

    // Get league settings if league_id is provided
    let leagueBudget = null;
    let leagueMaxRiders = null;

    if (league_id) {
      const { data: league } = await supabase
        .from('leagues')
        .select('settings')
        .eq('id', league_id)
        .single();
      
      if (league?.settings) {
        leagueBudget = league.settings.budget;
        leagueMaxRiders = league.settings.max_riders;
      }
    }

    // Get active auction - CRITICAL: filter by league_id to avoid selecting wrong auction
    const { data: auction } = await supabase
      .from('auctions')
      .select('id, round_number, statut, phase_id')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .eq('statut', 'open')
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      return new Response(JSON.stringify({ error: 'Aucune enchère active pour cette ligue' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎯 Active auction found for submit:', { 
      auction_id: auction.id, 
      league_id, 
      round_number: auction.round_number 
    });

    // Validation 0 : phase_id obligatoire (sécurité anti-enchères fantômes)
    // Note: Cette validation ne devrait jamais échouer grâce au filtre dans la requête
    // et à la contrainte NOT NULL en DB, mais on garde une double sécurité
    if (!auction.phase_id) {
      console.error('❌ Invalid auction: phase_id is NULL', auction.id);
      return new Response(
        JSON.stringify({ 
          error: 'Cette enchère est invalide (pas de phase associée)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get phase info with saison_id
    const { data: phase } = await supabase
      .from('phases')
      .select('budget, max_coureurs, saison_id')
      .eq('id', phase_id)
      .single();

    if (!phase) {
      return new Response(JSON.stringify({ error: 'Phase not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use league-specific settings if available, otherwise use phase defaults
    const budget = leagueBudget ?? phase.budget;
    const max_coureurs = leagueMaxRiders ?? phase.max_coureurs;

    console.log(`[auction-submit] Using budget: ${budget}, max_coureurs: ${max_coureurs} (league: ${league_id ? 'YES' : 'NO'})`);


    // CRITICAL: Get draft bids filtered by league_id
    const { data: draftBids } = await supabase
      .from('bids')
      .select('id, coureur_id, montant')
      .eq('auction_id', auction.id)
      .eq('manager_id', manager_id)
      .eq('league_id', league_id)
      .eq('statut', 'draft');

    if (!draftBids || draftBids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucune enchère brouillon à valider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing roster count
    const { count: rosterCount } = await supabase
      .from('rosters')
      .select('*', { count: 'exact', head: true })
      .eq('phase_id', phase_id)
      .eq('manager_id', manager_id)
      .eq('league_id', league_id);

    const currentRosterCount = rosterCount || 0;
    const totalSlots = currentRosterCount + draftBids.length;

    // VALIDATION STRICTE
    
    // 1. Check exact slot count (roster + new bids)
    if (totalSlots !== max_coureurs) {
      return new Response(
        JSON.stringify({ 
          error: `Effectif incorrect : tu dois avoir exactement ${max_coureurs} coureurs. Actuellement: ${currentRosterCount} en roster + ${draftBids.length} enchères = ${totalSlots} coureurs` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check budget: draft_sum + roster_spent <= phase.budget
    const draftSum = draftBids.reduce((sum, b) => sum + Number(b.montant), 0);
    
    // Get roster spent
    const { data: rosterBids } = await supabase
      .from('rosters')
      .select('prix_signature')
      .eq('phase_id', phase_id)
      .eq('manager_id', manager_id)
      .eq('league_id', league_id);
    
    const rosterSpent = (rosterBids || []).reduce((sum, r) => sum + Number(r.prix_signature), 0);
    const totalSpent = rosterSpent + draftSum;
    
    if (Math.abs(totalSpent - budget) > 0) {
      const diff = totalSpent - budget;
      const message = diff > 0 
        ? `Budget dépassé de ${diff}. Total: ${totalSpent} (roster: ${rosterSpent} + enchères: ${draftSum}). Budget: ${budget}`
        : `Budget sous-utilisé de ${Math.abs(diff)}. Total: ${totalSpent} (roster: ${rosterSpent} + enchères: ${draftSum}). Budget: ${budget}`;
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check no duplicates
    const coureurIds = draftBids.map(b => b.coureur_id);
    const uniqueCoureurIds = new Set(coureurIds);
    if (uniqueCoureurIds.size !== coureurIds.length) {
      return new Response(
        JSON.stringify({ error: 'Doublons détectés dans tes enchères' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check all amounts >= prix_initial
    console.log(`🔍 Fetching ${coureurIds.length} coureurs for saison_id: ${phase.saison_id}`, coureurIds);
    
    // Fetch prix_initial from coureurs_saisons
    const { data: coureursSeasons, error: seasonsError } = await supabase
      .from('coureurs_saisons')
      .select('coureur_id, prix_initial')
      .eq('saison_id', phase.saison_id)
      .in('coureur_id', coureurIds);
    
    if (seasonsError) {
      console.error('❌ Error fetching coureurs_saisons:', seasonsError);
      throw seasonsError;
    }
    
    console.log(`✅ Found ${coureursSeasons?.length || 0} entries in coureurs_saisons`);
    
    // Fetch noms from coureurs
    const { data: coureursData, error: coureursError } = await supabase
      .from('coureurs')
      .select('id, nom')
      .in('id', coureurIds);
    
    if (coureursError) {
      console.error('❌ Error fetching coureurs:', coureursError);
      throw coureursError;
    }
    
    console.log(`✅ Found ${coureursData?.length || 0} entries in coureurs`);
    
    // Create maps for easy lookup
    const priceMap = new Map((coureursSeasons || []).map(cs => [cs.coureur_id, cs.prix_initial]));
    const nameMap = new Map((coureursData || []).map(c => [c.id, c.nom]));
    
    // Build final coureurs map
    const coureursMap = new Map();
    for (const coureurId of coureurIds) {
      const prix_initial = priceMap.get(coureurId);
      const nom = nameMap.get(coureurId);
      
      if (!prix_initial && prix_initial !== 0) {
        console.error(`❌ Missing prix_initial for coureur ${coureurId}`);
      }
      if (!nom) {
        console.error(`❌ Missing nom for coureur ${coureurId}`);
      }
      
      coureursMap.set(coureurId, {
        id: coureurId,
        nom: nom || coureurId,
        prix_initial: prix_initial || 0
      });
    }
    
    console.log(`✅ Built coureursMap with ${coureursMap.size} entries`);

    for (const bid of draftBids) {
      const coureur = coureursMap.get(bid.coureur_id);
      if (!coureur) {
        console.error(`❌ Coureur ${bid.coureur_id} not in map. Map has:`, Array.from(coureursMap.keys()));
        return new Response(
          JSON.stringify({ error: `Coureur introuvable: ${bid.coureur_id}. Vérifiez que ce coureur existe bien dans la base de données pour cette saison.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (bid.montant < coureur.prix_initial) {
        return new Response(
          JSON.stringify({ 
            error: `Le montant pour ${coureur.nom} (${bid.montant}) est inférieur au prix initial (${coureur.prix_initial})` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Check no coureur already in rosters
    const { data: existingRosters } = await supabase
      .from('rosters')
      .select('coureur_id')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .in('coureur_id', coureurIds);

    if (existingRosters && existingRosters.length > 0) {
      const takenIds = existingRosters.map(r => r.coureur_id);
      const takenNames = takenIds
        .map(id => coureursMap.get(id)?.nom)
        .filter(Boolean)
        .join(', ');
      return new Response(
        JSON.stringify({ 
          error: `Ces coureurs ont déjà été attribués: ${takenNames}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ALL VALIDATIONS PASSED → Transition to 'pending'
    const bidIds = draftBids.map(b => b.id);
    const { error: updateError } = await supabase
      .from('bids')
      .update({ statut: 'pending' })
      .in('id', bidIds);

    if (updateError) throw updateError;

    console.log(`✅ Manager ${manager_id} validated ${draftBids.length} bids for auction ${auction.id}`);

    // Check if all eligible managers have validated their bids (pending status)
    try {
      console.log('🔍 Checking if all eligible managers have validated...');
      
      // Use the same logic as auction-get-validation-status
      // Step 1: Get league config
      const { data: leagueConfig } = await supabase
        .from('leagues')
        .select('settings')
        .eq('id', league_id)
        .single();
      
      let maxRiders = leagueConfig?.settings?.max_riders ? Number(leagueConfig.settings.max_riders) : 0;
      if (!maxRiders) {
        maxRiders = max_coureurs;
      }
      
      // Step 2: Get all league members' manager IDs
      const { data: leagueMembers } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', league_id);
      
      if (!leagueMembers || leagueMembers.length === 0) {
        throw new Error('No league members');
      }
      
      const { data: allManagers } = await supabase
        .from('managers')
        .select('id, nom')
        .in('user_id', leagueMembers.map(m => m.user_id));
      
      if (!allManagers || allManagers.length === 0) {
        throw new Error('No managers');
      }
      
      // Step 3: Find eligible managers (those with slots remaining)
      const eligibleManagerIds: string[] = [];
      for (const mgr of allManagers) {
        const { count } = await supabase
          .from('rosters')
          .select('*', { count: 'exact', head: true })
          .eq('manager_id', mgr.id)
          .eq('phase_id', phase_id)
          .eq('league_id', league_id);
        
        if ((count || 0) < maxRiders) {
          eligibleManagerIds.push(mgr.id);
        }
      }
      
      console.log(`📊 Eligible managers (slots remaining): ${eligibleManagerIds.length}/${allManagers.length}`);
      
      if (eligibleManagerIds.length === 0) {
        console.log('⚠️ No eligible managers (all rosters full)');
        throw new Error('No eligible managers');
      }
      
      // Step 4: Count how many eligible managers have pending bids
      const { data: validatedBids } = await supabase
        .from('bids')
        .select('manager_id')
        .eq('auction_id', auction.id)
        .eq('league_id', league_id)
        .eq('statut', 'pending')
        .in('manager_id', eligibleManagerIds);
      
      const validatedManagerIds = [...new Set((validatedBids || []).map(b => b.manager_id))];
      const waitingManagers = eligibleManagerIds.filter(id => !validatedManagerIds.includes(id));
      
      console.log(`📊 Validated: ${validatedManagerIds.length}/${eligibleManagerIds.length}, Waiting: ${waitingManagers.length}`);
      
      if (validatedManagerIds.length === eligibleManagerIds.length && eligibleManagerIds.length > 0) {
        console.log('🎉 All eligible managers have validated! Auto-closing round...');
        
        // Auto-close: call clore-round with auto_mode (service role, bypasses admin check)
        const { error: closeError } = await supabase.functions.invoke('clore-round', {
          body: {
            auction_id: auction.id,
            league_id: league_id,
            auto_mode: true,
          }
        });
        
        if (closeError) {
          console.error('❌ Error auto-closing round:', closeError);
        } else {
          console.log('✅ Round automatically closed and annonces publishing triggered');
        }
      } else {
        const waitingNames = allManagers
          .filter(m => waitingManagers.includes(m.id))
          .map(m => m.nom);
        console.log(`⏳ Waiting for: ${waitingNames.join(', ')}`);
        
        // Fetch league name for notification context
        const { data: leagueInfo } = await supabase
          .from('leagues')
          .select('name')
          .eq('id', league_id)
          .single();
        const leagueName = leagueInfo?.name || 'Ligue';

        // Send notification that someone validated
        const { notifyLeagueMembers } = await import('../_shared/notifications.ts');
        
        await notifyLeagueMembers(supabase, league_id, {
          type: 'auction_validation',
          title: '✅ Enchères validées',
          message: `Un manager a validé ses enchères. En attente de ${waitingManagers.length} manager(s)...`,
          metadata: {
            auction_id: auction.id,
            round_number: auction.round_number,
            phase_id,
            league_id,
            league_name: leagueName,
            complete_managers: validatedManagerIds.length,
            total_managers: eligibleManagerIds.length
          }
        });
      }
    } catch (autoCloseError) {
      // Don't fail the whole request if auto-close check fails
      console.error('❌ Error in auto-close check:', autoCloseError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${draftBids.length} enchères validées avec succès`,
        validated_count: draftBids.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-submit-all-bids:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
