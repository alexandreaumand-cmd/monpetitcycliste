import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BONUS_SCOREURS_POINTS = 200;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Also create user-authenticated client for permission check
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

    const { phase_id } = await req.json();

    if (!phase_id) {
      return new Response(
        JSON.stringify({ error: 'phase_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Computing bonus scoreurs for phase ${phase_id}`);

    // Get phase info
    const { data: phase, error: phaseError } = await supabase
      .from('phases')
      .select('id, saison_id')
      .eq('id', phase_id)
      .single();

    if (phaseError || !phase) {
      return new Response(
        JSON.stringify({ error: 'Phase non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all leagues that have this phase in scope
    const { data: leagueScopes, error: scopesError } = await supabase
      .from('league_scopes')
      .select('league_id')
      .eq('season_id', phase.saison_id);

    if (scopesError) {
      console.error('Error fetching league scopes:', scopesError);
      throw scopesError;
    }

    const leagueIds = leagueScopes?.map(s => s.league_id) || [];
    console.log(`Found ${leagueIds.length} leagues for this season`);

    if (leagueIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Aucune ligue trouvée pour cette saison', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get non-TTT scoring riders using the database function
    // This excludes riders who only scored points in TTT races
    const { data: scoringRidersData, error: scoringError } = await supabase
      .rpc('get_non_ttt_scoring_riders', { p_phase_id: phase_id });

    if (scoringError) {
      console.error('Error fetching non-TTT scoring riders:', scoringError);
      throw scoringError;
    }

    const scoringRiderIds = scoringRidersData?.map((r: { coureur_id: string }) => r.coureur_id) || [];
    console.log(`Found ${scoringRiderIds.length} non-TTT scoring riders in phase`);

    if (scoringRiderIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Aucun coureur scoreur (hors TTT) dans cette phase', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      league_id: string;
      manager_id: string;
      scoring_riders: number;
      points: number;
      action: string;
    }> = [];

    // Process each league
    for (const leagueId of leagueIds) {
      console.log(`Processing league ${leagueId}`);

      // Get rosters for this league/phase - managers who own scoring riders
      const { data: rosters, error: rostersError } = await supabase
        .from('rosters')
        .select('manager_id, coureur_id')
        .eq('phase_id', phase_id)
        .eq('league_id', leagueId)
        .in('coureur_id', scoringRiderIds);

      if (rostersError) {
        console.error(`Error fetching rosters for league ${leagueId}:`, rostersError);
        continue;
      }

      if (!rosters || rosters.length === 0) {
        console.log(`No scoring riders in rosters for league ${leagueId}`);
        continue;
      }

      // Count distinct scoring riders per manager
      const managerScoringCount: Map<string, Set<string>> = new Map();
      
      for (const roster of rosters) {
        if (!roster.manager_id || !roster.coureur_id) continue;
        
        if (!managerScoringCount.has(roster.manager_id)) {
          managerScoringCount.set(roster.manager_id, new Set());
        }
        managerScoringCount.get(roster.manager_id)!.add(roster.coureur_id);
      }

      // Find max scoring riders count
      let maxCount = 0;
      for (const [_, riders] of managerScoringCount) {
        if (riders.size > maxCount) {
          maxCount = riders.size;
        }
      }

      if (maxCount === 0) {
        console.log(`No scoring riders found for league ${leagueId}`);
        continue;
      }

      // Find all managers with max count (handles ties)
      const winnersManagerIds: string[] = [];
      for (const [managerId, riders] of managerScoringCount) {
        if (riders.size === maxCount) {
          winnersManagerIds.push(managerId);
        }
      }

      console.log(`League ${leagueId}: ${winnersManagerIds.length} winner(s) with ${maxCount} scoring riders (excluding TTT)`);

      // Award bonus to each winner
      for (const managerId of winnersManagerIds) {
        // Check if bonus already exists
        const { data: existing } = await supabase
          .from('manager_bonus_points')
          .select('id, bonus_scoreurs')
          .eq('phase_id', phase_id)
          .eq('manager_id', managerId)
          .eq('league_id', leagueId)
          .maybeSingle();

        const commentaire = `Auto-calculé: ${maxCount} coureurs scoreurs (hors TTT)${winnersManagerIds.length > 1 ? ' (ex-aequo)' : ''}`;

        if (existing) {
          // Update existing entry
          const { error: updateError } = await supabase
            .from('manager_bonus_points')
            .update({
              bonus_scoreurs: BONUS_SCOREURS_POINTS,
              commentaire,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Error updating bonus for manager ${managerId}:`, updateError);
          } else {
            results.push({
              league_id: leagueId,
              manager_id: managerId,
              scoring_riders: maxCount,
              points: BONUS_SCOREURS_POINTS,
              action: 'updated',
            });
          }
        } else {
          // Insert new entry
          const { error: insertError } = await supabase
            .from('manager_bonus_points')
            .insert({
              phase_id,
              manager_id: managerId,
              league_id: leagueId,
              bonus_scoreurs: BONUS_SCOREURS_POINTS,
              bonus_ttt: 0,
              bonus_itt: 0,
              bonus_first_win: 0,
              bonus_coureurs: 0,
              commentaire,
              created_by: currentManager.id,
            });

          if (insertError) {
            console.error(`Error inserting bonus for manager ${managerId}:`, insertError);
          } else {
            results.push({
              league_id: leagueId,
              manager_id: managerId,
              scoring_riders: maxCount,
              points: BONUS_SCOREURS_POINTS,
              action: 'created',
            });
          }
        }
      }
    }

    // Audit log
    await supabase.from('audits').insert({
      actor_manager_id: currentManager.id,
      action: 'compute_bonus_scoreurs',
      payload_json: JSON.stringify({
        phase_id,
        results_count: results.length,
        leagues_processed: leagueIds.length,
        note: 'TTT results excluded from scorer count',
      })
    });

    console.log(`Bonus scoreurs computation complete: ${results.length} bonuses awarded (TTT excluded)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${results.length} bonus scoreurs attribués (hors TTT)`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compute-bonus-scoreurs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
