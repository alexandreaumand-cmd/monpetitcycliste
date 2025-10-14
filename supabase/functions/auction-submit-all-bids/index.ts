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

    const { phase_id, manager_id: input_manager_id } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
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

    // Get active auction
    const { data: auction } = await supabase
      .from('auctions')
      .select('id, round_number, statut')
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

    // Get phase info
    const { data: phase } = await supabase
      .from('phases')
      .select('budget, max_coureurs')
      .eq('id', phase_id)
      .single();

    if (!phase) {
      return new Response(JSON.stringify({ error: 'Phase not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get draft bids
    const { data: draftBids } = await supabase
      .from('bids')
      .select('id, coureur_id, montant')
      .eq('auction_id', auction.id)
      .eq('manager_id', manager_id)
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
      .eq('manager_id', manager_id);

    const currentRosterCount = rosterCount || 0;
    const totalSlots = currentRosterCount + draftBids.length;

    // VALIDATION STRICTE
    
    // 1. Check exact slot count (roster + new bids)
    if (totalSlots !== phase.max_coureurs) {
      return new Response(
        JSON.stringify({ 
          error: `Effectif incorrect : tu dois avoir exactement ${phase.max_coureurs} coureurs. Actuellement: ${currentRosterCount} en roster + ${draftBids.length} enchères = ${totalSlots} coureurs` 
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
      .eq('manager_id', manager_id);
    
    const rosterSpent = (rosterBids || []).reduce((sum, r) => sum + Number(r.prix_signature), 0);
    const totalSpent = rosterSpent + draftSum;
    
    if (Math.abs(totalSpent - phase.budget) > 0) {
      const diff = totalSpent - phase.budget;
      const message = diff > 0 
        ? `Budget dépassé de ${diff}. Total: ${totalSpent} (roster: ${rosterSpent} + enchères: ${draftSum}). Budget: ${phase.budget}`
        : `Budget sous-utilisé de ${Math.abs(diff)}. Total: ${totalSpent} (roster: ${rosterSpent} + enchères: ${draftSum}). Budget: ${phase.budget}`;
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
