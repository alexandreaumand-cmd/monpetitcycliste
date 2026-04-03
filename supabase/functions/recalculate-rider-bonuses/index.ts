import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Service role client for bypassing RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // User-authenticated client for permission check
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify superadmin access
    const { data: isSuperAdmin, error: roleError } = await userSupabase.rpc('is_superadmin');
    if (roleError || !isSuperAdmin) {
      console.error('Superadmin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé aux superadministrateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user's manager ID for audit
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: currentManager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!currentManager) {
      return new Response(
        JSON.stringify({ error: 'Manager non trouvé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phase_id, coureur_id } = await req.json();

    if (!phase_id) {
      return new Response(
        JSON.stringify({ error: 'phase_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Recalculating rider bonuses for phase ${phase_id}${coureur_id ? ` (coureur: ${coureur_id})` : ' (all riders)'}`);

    // 1. Get bonus_rider_selections for this phase
    let selectionsQuery = supabase
      .from('bonus_rider_selections')
      .select('coureur_id, manager_id, league_id')
      .eq('phase_id', phase_id);

    if (coureur_id) {
      selectionsQuery = selectionsQuery.eq('coureur_id', coureur_id);
    }

    const { data: selections, error: selectionsError } = await selectionsQuery;

    if (selectionsError) {
      console.error('Error fetching selections:', selectionsError);
      throw selectionsError;
    }

    if (!selections || selections.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Aucune sélection de coureur bonusé trouvée pour cette phase',
          recalculated: 0,
          total_before: 0,
          total_after: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${selections.length} rider selections`);

    let totalBefore = 0;
    let totalAfter = 0;
    let bonusesCreated = 0;

    // 2. Process each selection
    for (const selection of selections) {
      const { coureur_id: riderId, manager_id: managerId, league_id: leagueId } = selection;

      // 2a. Get existing bonuses for this coureur/manager/league/phase to calculate total_before
      const { data: existingBonuses } = await supabase
        .from('bonus_points')
        .select('id, points')
        .eq('phase_id', phase_id)
        .eq('coureur_id', riderId)
        .eq('manager_id', managerId)
        .eq('league_id', leagueId)
        .eq('bonus_type', 'coureur_bonuse');

      const existingTotal = (existingBonuses || []).reduce((sum, b) => sum + Number(b.points), 0);
      totalBefore += existingTotal;

      // 2b. Delete existing coureur_bonuse for this coureur/manager/league/phase
      const { error: deleteError } = await supabase
        .from('bonus_points')
        .delete()
        .eq('phase_id', phase_id)
        .eq('coureur_id', riderId)
        .eq('manager_id', managerId)
        .eq('league_id', leagueId)
        .eq('bonus_type', 'coureur_bonuse');

      if (deleteError) {
        console.error(`Error deleting bonuses for rider ${riderId}:`, deleteError);
        continue;
      }

      // 2c. Get all points_ledger entries for this coureur/phase
      const { data: ledgerEntries, error: ledgerError } = await supabase
        .from('points_ledger')
        .select('id, points, course_id, type_classement, etape_numero')
        .eq('phase_id', phase_id)
        .eq('coureur_id', riderId);

      if (ledgerError) {
        console.error(`Error fetching ledger for rider ${riderId}:`, ledgerError);
        continue;
      }

      if (!ledgerEntries || ledgerEntries.length === 0) {
        console.log(`No ledger entries for rider ${riderId} in phase ${phase_id}`);
        continue;
      }

      // 2d. Calculate 25% for each entry and insert
      const bonusInserts = ledgerEntries
        .filter(entry => Number(entry.points) > 0)
        .map(entry => {
          const bonusPoints = Math.round(Number(entry.points) * 0.25 * 100) / 100;
          const etapeLabel = entry.etape_numero ? ` Etape ${entry.etape_numero}` : '';
          return {
            phase_id,
            coureur_id: riderId,
            manager_id: managerId,
            league_id: leagueId,
            bonus_type: 'coureur_bonuse',
            points: bonusPoints,
            commentaire: `Bonus coureur automatique (25%) - ${entry.course_id} - ${entry.type_classement}${etapeLabel} [recalculé]`,
            created_by: currentManager.id,
            target_manager_id: null,
          };
        });

      if (bonusInserts.length > 0) {
        const { error: insertError } = await supabase
          .from('bonus_points')
          .insert(bonusInserts);

        if (insertError) {
          console.error(`Error inserting bonuses for rider ${riderId}:`, insertError);
          continue;
        }

        const newTotal = bonusInserts.reduce((sum, b) => sum + b.points, 0);
        totalAfter += newTotal;
        bonusesCreated += bonusInserts.length;

        console.log(`Rider ${riderId}: ${bonusInserts.length} bonuses created (${existingTotal} -> ${newTotal})`);
      }
    }

    // 3. Refresh materialized views
    console.log('Refreshing standings materialized views...');
    const { error: refreshError } = await supabase.rpc('refresh_standings_views');
    if (refreshError) {
      console.error('Error refreshing standings views:', refreshError);
    } else {
      console.log('Standings views refreshed successfully');
    }

    // 4. Audit log
    await supabase.from('audits').insert({
      actor_manager_id: currentManager.id,
      action: 'recalculate_rider_bonuses',
      payload_json: JSON.stringify({
        phase_id,
        coureur_id: coureur_id || 'all',
        selections_count: selections.length,
        bonuses_created: bonusesCreated,
        total_before: totalBefore,
        total_after: totalAfter,
      })
    });

    const variation = totalAfter - totalBefore;
    const variationLabel = variation >= 0 ? `+${variation.toFixed(2)}` : variation.toFixed(2);

    console.log(`Recalculation complete: ${bonusesCreated} bonuses (${totalBefore.toFixed(2)} -> ${totalAfter.toFixed(2)}, ${variationLabel})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${bonusesCreated} bonus recalculés (${variationLabel} pts)`,
        recalculated: bonusesCreated,
        total_before: totalBefore,
        total_after: totalAfter,
        variation,
        selections_processed: selections.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recalculate-rider-bonuses:', error);
    const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
