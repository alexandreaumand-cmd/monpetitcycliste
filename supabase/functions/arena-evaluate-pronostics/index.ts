import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is super-admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Not authorized - super-admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_id, etape_numero, pronostic_type } = await req.json();

    if (!course_id || !pronostic_type) {
      return new Response(JSON.stringify({ error: 'course_id and pronostic_type are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this deadline is TTT
    let deadlineQuery = adminClient
      .from('arena_pronostic_deadlines')
      .select('is_ttt')
      .eq('course_id', course_id)
      .eq('pronostic_type', pronostic_type);

    if (etape_numero !== null && etape_numero !== undefined) {
      deadlineQuery = deadlineQuery.eq('etape_numero', etape_numero);
    } else {
      deadlineQuery = deadlineQuery.is('etape_numero', null);
    }

    const { data: deadlineData } = await deadlineQuery.maybeSingle();
    const isTTT = deadlineData?.is_ttt === true;

    // Map pronostic_type to race_results type_classement
    let type_classement: string;
    if (pronostic_type === 'stage_winner') {
      type_classement = 'Etape';
    } else if (pronostic_type === 'gc_winner') {
      type_classement = 'General';
    } else if (pronostic_type === 'one_day_winner') {
      type_classement = 'General';
    } else {
      return new Response(JSON.stringify({ error: 'Invalid pronostic_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find winner from race_results (position = 1)
    const findWinner = async (typeClass: string) => {
      let q = adminClient
        .from('race_results')
        .select('coureur_id')
        .eq('course_id', course_id)
        .eq('type_classement', typeClass)
        .eq('position', 1);

      if (etape_numero !== null && etape_numero !== undefined) {
        q = q.eq('etape_numero', etape_numero);
      } else {
        q = q.is('etape_numero', null);
      }

      return await q.limit(1).maybeSingle();
    };

    let { data: winnerData, error: winnerError } = await findWinner(type_classement);

    if (winnerError) {
      console.error('[evaluate] Winner query error:', winnerError);
      throw winnerError;
    }

    // Fallback: for one_day_winner, try 'Etape' if no result found with 'General'
    if (!winnerData?.coureur_id && pronostic_type === 'one_day_winner') {
      console.log(`[evaluate] No winner with '${type_classement}', trying 'Etape' fallback`);
      type_classement = 'Etape';
      const fallback = await findWinner(type_classement);
      if (fallback.error) {
        console.error('[evaluate] Fallback query error:', fallback.error);
        throw fallback.error;
      }
      winnerData = fallback.data;
    }

    if (!winnerData?.coureur_id) {
      return new Response(JSON.stringify({
        error: 'No winner found',
        details: `No position 1 result for course=${course_id} type=${type_classement} etape=${etape_numero}`,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const winnerId = winnerData.coureur_id;
    const now = new Date().toISOString();

    console.log(`[evaluate] Winner: ${winnerId} for ${course_id} ${pronostic_type} etape=${etape_numero} isTTT=${isTTT}`);

    // For TTT: find the equipe_saison_id of the winning rider
    let winnerEquipeSaisonId: string | null = null;
    if (isTTT) {
      // Get the course's season
      const { data: courseData } = await adminClient
        .from('courses')
        .select('phase_id')
        .eq('id', course_id)
        .maybeSingle();

      if (courseData?.phase_id) {
        const { data: phaseData } = await adminClient
          .from('phases')
          .select('saison_id')
          .eq('id', courseData.phase_id)
          .maybeSingle();

        if (phaseData?.saison_id) {
          // Find the rider's equipe_saison_id
          const { data: coureurSaison } = await adminClient
            .from('coureurs_saisons')
            .select('equipe_id')
            .eq('coureur_id', winnerId)
            .eq('saison_id', phaseData.saison_id)
            .maybeSingle();

          if (coureurSaison?.equipe_id) {
            const { data: equipeSaison } = await adminClient
              .from('equipes_saisons')
              .select('id')
              .eq('equipe_id', coureurSaison.equipe_id)
              .eq('saison_id', phaseData.saison_id)
              .maybeSingle();

            winnerEquipeSaisonId = equipeSaison?.id || null;
          }
        }
      }

      console.log(`[evaluate] TTT winner equipe_saison_id: ${winnerEquipeSaisonId}`);

      if (!winnerEquipeSaisonId) {
        return new Response(JSON.stringify({
          error: 'Could not resolve winning team for TTT',
          details: `Winner rider ${winnerId} could not be mapped to an equipe_saison`,
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Build base filter for pronostics
    const buildFilter = (query: any) => {
      let q = query
        .eq('course_id', course_id)
        .eq('pronostic_type', pronostic_type)
        .is('is_correct', null);

      if (etape_numero !== null && etape_numero !== undefined) {
        q = q.eq('etape_numero', etape_numero);
      } else {
        q = q.is('etape_numero', null);
      }
      return q;
    };

    let correctUpdated: any[] = [];
    let incorrectUpdated: any[] = [];

    if (isTTT && winnerEquipeSaisonId) {
      // TTT: compare equipe_saison_id
      const correctQuery = buildFilter(
        adminClient
          .from('arena_pronostics')
          .update({ is_correct: true, evaluated_at: now })
      ).eq('equipe_saison_id', winnerEquipeSaisonId);

      const { data: correct, error: correctError } = await correctQuery.select('id, league_id, manager_id');
      if (correctError) console.error('[evaluate] Correct update error:', correctError);
      correctUpdated = correct || [];

      const incorrectQuery = buildFilter(
        adminClient
          .from('arena_pronostics')
          .update({ is_correct: false, evaluated_at: now })
      ).neq('equipe_saison_id', winnerEquipeSaisonId);

      const { data: incorrect, error: incorrectError } = await incorrectQuery.select('id');
      if (incorrectError) console.error('[evaluate] Incorrect update error:', incorrectError);
      incorrectUpdated = incorrect || [];
    } else {
      // Standard: compare coureur_id
      const correctQuery = buildFilter(
        adminClient
          .from('arena_pronostics')
          .update({ is_correct: true, evaluated_at: now })
      ).eq('coureur_id', winnerId);

      const { data: correct, error: correctError } = await correctQuery.select('id, league_id, manager_id');
      if (correctError) console.error('[evaluate] Correct update error:', correctError);
      correctUpdated = correct || [];

      const incorrectQuery = buildFilter(
        adminClient
          .from('arena_pronostics')
          .update({ is_correct: false, evaluated_at: now })
      ).neq('coureur_id', winnerId);

      const { data: incorrect, error: incorrectError } = await incorrectQuery.select('id');
      if (incorrectError) console.error('[evaluate] Incorrect update error:', incorrectError);
      incorrectUpdated = incorrect || [];
    }

    // Insert prestige points for correct pronostics (+1 each)
    if (correctUpdated.length > 0) {
      const prestigeRows = correctUpdated.map((p: any) => ({
        league_id: p.league_id,
        manager_id: p.manager_id,
        points: 1,
        source_type: 'pronostic',
        source_id: p.id,
      }));
      const { error: prestigeError } = await adminClient
        .from('arena_prestige_points')
        .upsert(prestigeRows, { onConflict: 'source_type,source_id' });
      if (prestigeError) console.error('[evaluate] Prestige insert error:', prestigeError);
      else console.log(`[evaluate] Inserted ${prestigeRows.length} prestige points`);
    }

    const result = {
      winner_coureur_id: winnerId,
      winner_equipe_saison_id: winnerEquipeSaisonId,
      is_ttt: isTTT,
      correct_count: correctUpdated.length,
      incorrect_count: incorrectUpdated.length,
    };

    console.log('[evaluate] Result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[evaluate] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
