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

    const {
      phase_id,
      q = null,
      teams = null,
      cote_min = null,
      cote_max = null,
      limit = 50,
      offset = 0,
      exclude_rider_ids = null,
    } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build query
    let query = supabase
      .from('coureurs_disponibilite')
      .select('coureur_id, coureur_nom, coureur_equipe, prix_initial, is_taken')
      .eq('phase_id', phase_id)
      .eq('is_taken', false); // Only show available riders

    // Search by name (fuzzy)
    if (q && q.trim().length >= 2) {
      query = query.ilike('search_text', `%${q.trim().toLowerCase()}%`);
    }

    // Filter by teams
    if (teams && Array.isArray(teams) && teams.length > 0) {
      query = query.in('coureur_equipe', teams);
    }

    // Filter by cote (prix_initial)
    if (cote_min !== null) {
      query = query.gte('prix_initial', cote_min);
    }
    if (cote_max !== null) {
      query = query.lte('prix_initial', cote_max);
    }

    // Exclude already selected riders
    if (exclude_rider_ids && Array.isArray(exclude_rider_ids) && exclude_rider_ids.length > 0) {
      query = query.not('coureur_id', 'in', `(${exclude_rider_ids.join(',')})`);
    }

    // Pagination
    query = query
      .order('coureur_nom', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: riders, error } = await query;

    if (error) throw error;

    const items = (riders || []).map(r => ({
      rider_id: r.coureur_id,
      rider_nom: r.coureur_nom,
      rider_team: r.coureur_equipe,
      cote: r.prix_initial,
    }));

    const has_more = items.length === limit;

    return new Response(
      JSON.stringify({
        items,
        pagination: { limit, offset, has_more },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-search-riders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
