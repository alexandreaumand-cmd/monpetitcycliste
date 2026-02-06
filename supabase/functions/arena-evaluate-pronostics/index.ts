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

    // Map pronostic_type to race_results type_classement
    let type_classement: string;
    if (pronostic_type === 'stage_winner') {
      type_classement = 'Etape';
    } else if (pronostic_type === 'gc_winner') {
      type_classement = 'General';
    } else if (pronostic_type === 'one_day_winner') {
      type_classement = 'Etape';
    } else {
      return new Response(JSON.stringify({ error: 'Invalid pronostic_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find winner from race_results (position = 1)
    let winnerQuery = adminClient
      .from('race_results')
      .select('coureur_id')
      .eq('course_id', course_id)
      .eq('type_classement', type_classement)
      .eq('position', 1);

    if (etape_numero !== null && etape_numero !== undefined) {
      winnerQuery = winnerQuery.eq('etape_numero', etape_numero);
    } else {
      winnerQuery = winnerQuery.is('etape_numero', null);
    }

    const { data: winnerData, error: winnerError } = await winnerQuery.limit(1).maybeSingle();

    if (winnerError) {
      console.error('[evaluate] Winner query error:', winnerError);
      throw winnerError;
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

    console.log(`[evaluate] Winner: ${winnerId} for ${course_id} ${pronostic_type} etape=${etape_numero}`);

    // Build base filter for pronostics
    const buildFilter = (query: any) => {
      let q = query
        .eq('course_id', course_id)
        .eq('pronostic_type', pronostic_type)
        .is('is_correct', null); // Only evaluate non-evaluated pronostics

      if (etape_numero !== null && etape_numero !== undefined) {
        q = q.eq('etape_numero', etape_numero);
      } else {
        q = q.is('etape_numero', null);
      }
      return q;
    };

    // Update correct pronostics
    const correctQuery = buildFilter(
      adminClient
        .from('arena_pronostics')
        .update({ is_correct: true, evaluated_at: now })
    ).eq('coureur_id', winnerId);

    const { data: correctUpdated, error: correctError } = await correctQuery.select('id');
    if (correctError) console.error('[evaluate] Correct update error:', correctError);

    // Update incorrect pronostics
    const incorrectQuery = buildFilter(
      adminClient
        .from('arena_pronostics')
        .update({ is_correct: false, evaluated_at: now })
    ).neq('coureur_id', winnerId);

    const { data: incorrectUpdated, error: incorrectError } = await incorrectQuery.select('id');
    if (incorrectError) console.error('[evaluate] Incorrect update error:', incorrectError);

    const result = {
      winner_coureur_id: winnerId,
      correct_count: correctUpdated?.length || 0,
      incorrect_count: incorrectUpdated?.length || 0,
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
