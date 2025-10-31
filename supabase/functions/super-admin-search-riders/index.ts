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
      categories = null,
      cote_min = null,
      cote_max = null,
      limit = 100,
      offset = 0,
      order_by = 'nom', // 'nom' | 'cote'
    } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[super-admin-search-riders] Request:', { phase_id, q, teams, categories, limit, offset, order_by });

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

    // Filter by teams (using equipe_id)
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
      console.error('[super-admin-search-riders] Error fetching riders:', error);
      throw error;
    }

    if (!coureursSaisons || coureursSaisons.length === 0) {
      console.log('[super-admin-search-riders] No riders found');
      return new Response(
        JSON.stringify({
          items: [],
          pagination: { limit, offset, has_more: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[super-admin-search-riders] Found ${coureursSaisons.length} riders`);

    // Step 3: Get team names and categories for all riders
    const equipeIds = [...new Set(coureursSaisons.map((cs: any) => cs.equipe_id).filter(Boolean))];
    
    console.log(`[super-admin-search-riders] saison_id=${phase.saison_id}, found ${equipeIds.length} unique teams`);
    
    let equipesMap = new Map();
    if (equipeIds.length > 0) {
      const { data: equipesData, error: equipesError } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, nom_affiche, categorie')
        .eq('saison_id', phase.saison_id)
        .in('equipe_id', equipeIds);
      
      if (equipesError) {
        console.error('[super-admin-search-riders] Error fetching team names:', equipesError);
      } else if (equipesData) {
        console.log(`[super-admin-search-riders] Found ${equipesData.length} team names`);
        equipesData.forEach((eq: any) => {
          equipesMap.set(eq.equipe_id, {
            nom: eq.nom_affiche || 'N/A',
            categorie: eq.categorie
          });
        });
      }
    }

    // Step 4: Build items WITHOUT roster/manager information
    let items = coureursSaisons.map((cs: any) => {
      const equipeInfo = equipesMap.get(cs.equipe_id) || { nom: 'N/A', categorie: null };
      return {
        rider_id: cs.coureur_id,
        rider_nom: cs.coureurs.nom,
        rider_team: equipeInfo.nom,
        rider_team_category: equipeInfo.categorie,
        cote: cs.prix_initial,
      };
    });

    // Step 5: Apply category filter if specified
    if (categories && Array.isArray(categories) && categories.length > 0) {
      items = items.filter((i: any) => 
        i.rider_team_category && categories.includes(i.rider_team_category)
      );
    }

    console.log(`[super-admin-search-riders] Returning ${items.length} items`);

    const has_more = coureursSaisons.length === limit;

    return new Response(
      JSON.stringify({
        items,
        pagination: { limit, offset, has_more },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[super-admin-search-riders] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
