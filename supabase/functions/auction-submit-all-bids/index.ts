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

    const { phase_id, manager_id: input_manager_id, league_id } = await req.json();

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
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      return new Response(JSON.stringify({ error: 'Manager not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const manager_id = input_manager_id || manager.id;

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
      .select('id, round_number, statut')
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
    const { data: coureurs } = await supabase
      .from('coureurs_disponibilite_enrichie')
      .select('id, nom, prix_initial')
      .eq('phase_id', phase_id)
      .in('id', coureurIds);

    const coureursMap = new Map((coureurs || []).map(c => [c.id, c]));

    for (const bid of draftBids) {
      const coureur = coureursMap.get(bid.coureur_id);
      if (!coureur) {
        return new Response(
          JSON.stringify({ error: `Coureur introuvable: ${bid.coureur_id}` }),
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

    // Check if this was the last manager to validate
    try {
      const { data: validationStatus, error: validationError } = await supabase.functions.invoke(
        'auction-get-validation-status',
        { body: { phase_id, league_id } }
      );

      if (!validationError && validationStatus) {
        const { validated_count, total_managers } = validationStatus;
        
        console.log(`📊 Validation status: ${validated_count}/${total_managers} managers validated`);
        
        if (validated_count === total_managers && total_managers > 0) {
          console.log('🎉 All managers have validated! Sending notification...');
          
          // Import and call notification function
          const { notifyLeagueMembers } = await import('../_shared/notifications.ts');
          
          await notifyLeagueMembers(supabase, league_id, {
            type: 'auction_ready_to_close',
            title: '🎯 Enchères complètes !',
            message: `Tous les managers ont validé leurs enchères ! Les annonces vont bientôt arriver...`,
            metadata: {
              auction_id: auction.id,
              round_number: auction.round_number,
              phase_id,
              league_id
            }
          });
          
          console.log('✅ Notification sent to all league members');
        }
      }
    } catch (notifError) {
      // Don't fail the whole request if notification fails
      console.error('❌ Error sending notification:', notifError);
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
