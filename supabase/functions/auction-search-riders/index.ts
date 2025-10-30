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
    order_by = 'nom', // 'nom' | 'cote'
  } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[auction-search-riders] Request:', { phase_id, league_id, q, available_only, limit, offset, order_by });

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
      .select(`
        coureur_id,
        equipe_id,
        prix_initial,
        coureurs!inner(id, nom)
      `)
      .eq('saison_id', phase.saison_id);

    // Search by name
    if (q && q.trim().length >= 2) {
      query = query.ilike('coureurs.nom', `%${q.trim()}%`);
    }

    // Filter by teams (now using equipe_id instead of equipe text)
    if (teams && Array.isArray(teams) && teams.length > 0) {
      query = query.in('equipe_id', teams);
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

    // Pagination and ordering
    if (order_by === 'cote') {
      query = query
        .order('prix_initial', { ascending: false }) // Highest cote first
        .range(offset, offset + limit - 1);
    } else {
      query = query
        .order('nom', { foreignTable: 'coureurs', ascending: true })
        .range(offset, offset + limit - 1);
    }

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

    // Step 3: Get team names for all riders
    const equipeIds = [...new Set(coureursSaisons.map((cs: any) => cs.equipe_id).filter(Boolean))];
    
    let equipesMap = new Map();
    if (equipeIds.length > 0) {
      const { data: equipesData, error: equipesError } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, nom_affiche, equipes(nom_complet)')
        .eq('saison_id', phase.saison_id)
        .in('equipe_id', equipeIds);
      
      if (!equipesError && equipesData) {
        equipesData.forEach((eq: any) => {
          equipesMap.set(eq.equipe_id, eq.nom_affiche || eq.equipes?.nom_complet || 'N/A');
        });
      }
    }

    // Step 4: Calculate is_taken per league
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

    // Step 5: Enrich riders with is_taken status and team name
    const items = coureursSaisons.map((cs: any) => {
      const taken = takenMap.get(cs.coureur_id) || { is_taken: false, taken_by_manager_nom: null };
      const teamName = equipesMap.get(cs.equipe_id) || 'N/A';
      return {
        rider_id: cs.coureur_id,
        rider_nom: cs.coureurs.nom,
        rider_team: teamName,
        cote: cs.prix_initial,
        is_taken: taken.is_taken,
        taken_by_manager_nom: taken.taken_by_manager_nom,
      };
    });

    // Step 6: Filter by available_only after calculating league-specific is_taken
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
