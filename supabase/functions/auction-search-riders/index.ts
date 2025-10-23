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
      league_id = null,
      q = null,
      teams = null,
      cote_min = null,
      cote_max = null,
      limit = 100,
      offset = 0,
      exclude_rider_ids = null,
      available_only = true,
    } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[auction-search-riders] Request:', { phase_id, league_id, q, available_only, limit, offset });

    // Step 1: Get phase's saison_id
    const { data: phase, error: phaseError } = await supabase
      .from('phases')
      .select('saison_id')
      .eq('id', phase_id)
      .single();

    if (phaseError || !phase) {
      throw new Error('Phase not found');
    }

    // Step 2: Build base query on coureurs_saisons
    let query = supabase
      .from('coureurs_saisons')
      .select('coureur_id, equipe, prix_initial, coureurs!inner(id, nom)')
      .eq('saison_id', phase.saison_id);

    // Search by name
    if (q && q.trim().length >= 2) {
      query = query.ilike('coureurs.nom', `%${q.trim()}%`);
    }

    // Filter by teams
    if (teams && Array.isArray(teams) && teams.length > 0) {
      query = query.in('equipe', teams);
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
      .order('coureurs.nom', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: coureursSaisons, error } = await query;

    if (error) {
      console.error('[auction-search-riders] Error fetching riders:', error);
      throw error;
    }

    if (!coureursSaisons || coureursSaisons.length === 0) {
      console.log('[auction-search-riders] No riders found');
      return new Response(
        JSON.stringify({
          items: [],
          pagination: { limit, offset, has_more: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auction-search-riders] Found ${coureursSaisons.length} riders`);

    // Step 3: Calculate is_taken per league
    const riderIds = coureursSaisons.map((cs: any) => cs.coureur_id);
    
    let takenRiders: any[] = [];
    if (league_id) {
      // League-specific availability
      const { data: takenData, error: takenError } = await supabase
        .from('rosters')
        .select('coureur_id, manager_id, managers(nom)')
        .eq('phase_id', phase_id)
        .eq('league_id', league_id)
        .in('coureur_id', riderIds);

      if (takenError) {
        console.error('[auction-search-riders] Error fetching rosters:', takenError);
        throw takenError;
      }

      takenRiders = takenData || [];
      console.log(`[auction-search-riders] Found ${takenRiders.length} taken riders in league ${league_id}`);
    } else {
      // Global availability (legacy behavior)
      const { data: takenData, error: takenError } = await supabase
        .from('rosters')
        .select('coureur_id, manager_id, managers(nom)')
        .eq('phase_id', phase_id)
        .in('coureur_id', riderIds);

      if (takenError) {
        console.error('[auction-search-riders] Error fetching rosters:', takenError);
        throw takenError;
      }

      takenRiders = takenData || [];
      console.log(`[auction-search-riders] Found ${takenRiders.length} taken riders globally`);
    }

    // Build taken map
    const takenMap = new Map();
    takenRiders.forEach((r: any) => {
      takenMap.set(r.coureur_id, {
        is_taken: true,
        taken_by_manager_nom: r.managers?.nom || null
      });
    });

    // Step 4: Enrich riders with is_taken status
    const items = coureursSaisons.map((cs: any) => {
      const taken = takenMap.get(cs.coureur_id) || { is_taken: false, taken_by_manager_nom: null };
      return {
        rider_id: cs.coureur_id,
        rider_nom: cs.coureurs.nom,
        rider_team: cs.equipe,
        cote: cs.prix_initial,
        is_taken: taken.is_taken,
        taken_by_manager_nom: taken.taken_by_manager_nom,
      };
    });

    // Step 5: Filter by available_only after calculating league-specific is_taken
    const filteredItems = available_only 
      ? items.filter((i: any) => !i.is_taken)
      : items;

    console.log(`[auction-search-riders] Returning ${filteredItems.length} items (available_only: ${available_only})`);

    const has_more = coureursSaisons.length === limit;

    return new Response(
      JSON.stringify({
        items: filteredItems,
        pagination: { limit, offset, has_more },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[auction-search-riders] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
