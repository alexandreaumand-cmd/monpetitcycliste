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

    // Normalize search query: remove accents, lowercase
    const normalizeText = (text: string) => 
      text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Step 1: Get phase's saison_id
    const { data: phase, error: phaseError } = await supabase
      .from('phases')
      .select('saison_id')
      .eq('id', phase_id)
      .single();

    if (phaseError || !phase) {
      throw new Error('Phase not found');
    }

    // Step 2: Build base query on coureurs + coureurs_saisons
    let query = supabase
      .from('coureurs')
      .select(`
        id,
        nom,
        coureurs_saisons!inner(
          equipe,
          prix_initial,
          saison_id
        )
      `)
      .eq('coureurs_saisons.saison_id', phase.saison_id);

    // Search by name (accent-insensitive)
    if (q && q.trim().length >= 2) {
      const normalizedSearch = normalizeText(q.trim());
      // Use ilike on normalized nom
      query = query.ilike('nom', `%${q.trim()}%`);
    }

    // Filter by teams
    if (teams && Array.isArray(teams) && teams.length > 0) {
      query = query.in('coureurs_saisons.equipe', teams);
    }

    // Filter by cote (prix_initial)
    if (cote_min !== null) {
      query = query.gte('coureurs_saisons.prix_initial', cote_min);
    }
    if (cote_max !== null) {
      query = query.lte('coureurs_saisons.prix_initial', cote_max);
    }

    // Exclude already selected riders
    if (exclude_rider_ids && Array.isArray(exclude_rider_ids) && exclude_rider_ids.length > 0) {
      query = query.not('id', 'in', `(${exclude_rider_ids.join(',')})`);
    }

    // Pagination
    query = query
      .order('nom', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: riders, error } = await query;

    if (error) {
      console.error('[auction-search-riders] Error fetching riders:', error);
      throw error;
    }

    if (!riders || riders.length === 0) {
      console.log('[auction-search-riders] No riders found');
      return new Response(
        JSON.stringify({
          items: [],
          pagination: { limit, offset, has_more: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auction-search-riders] Found ${riders.length} riders`);

    // Step 3: Calculate is_taken per league
    const riderIds = riders.map(r => r.id);
    
    let takenRiders = [];
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
    takenRiders.forEach(r => {
      takenMap.set(r.coureur_id, {
        is_taken: true,
        taken_by_manager_nom: r.managers?.nom || null
      });
    });

    // Step 4: Enrich riders with is_taken status
    const items = riders.map(r => {
      const taken = takenMap.get(r.id) || { is_taken: false, taken_by_manager_nom: null };
      return {
        rider_id: r.id,
        rider_nom: r.nom,
        rider_team: r.coureurs_saisons[0]?.equipe || null,
        cote: r.coureurs_saisons[0]?.prix_initial || 10,
        is_taken: taken.is_taken,
        taken_by_manager_nom: taken.taken_by_manager_nom,
      };
    });

    // Step 5: Filter by available_only after calculating league-specific is_taken
    const filteredItems = available_only 
      ? items.filter(i => !i.is_taken)
      : items;

    console.log(`[auction-search-riders] Returning ${filteredItems.length} items (available_only: ${available_only})`);

    const has_more = riders.length === limit;

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
