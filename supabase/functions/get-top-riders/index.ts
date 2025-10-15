import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-top-riders function loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { saison_id, phase_id, limit = 5000 } = await req.json();

    console.log('Fetching top riders with filters:', { saison_id, phase_id, limit });

    // Call the optimized PostgreSQL RPC function
    const { data: items, error } = await supabase
      .rpc('get_top_riders_optimized', {
        p_saison_id: saison_id,
        p_phase_id: phase_id,
        p_limit: limit
      });

    if (error) {
      console.error('Error fetching top riders:', error);
      throw error;
    }

    console.log(`Fetched ${items.length} top riders from RPC`);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract unique rider IDs
    const riderIds = [...new Set(items.map((item: any) => item.rider_id))];

    // Fetch owner information
    let ownersMap: Record<string, any> = {};
    
    if (phase_id) {
      // Single phase context: query rosters for this specific phase
      const { data: rosterData, error: rosterError } = await supabase
        .from('rosters')
        .select('coureur_id, manager_id, managers(id, nom)')
        .eq('phase_id', phase_id)
        .in('coureur_id', riderIds);

      if (rosterError) {
        console.error('Error fetching rosters:', rosterError);
      } else if (rosterData) {
        console.log(`Found ${rosterData.length} roster entries for phase`);
        ownersMap = rosterData.reduce((acc: any, r: any) => {
          if (!acc[r.coureur_id]) {
            acc[r.coureur_id] = [];
          }
          if (r.managers) {
            acc[r.coureur_id].push({
              manager_id: r.manager_id,
              manager_nom: r.managers.nom
            });
          }
          return acc;
        }, {});
      }
    } else {
      // Season context: fetch all phases and build owners_all + owners_by_phase
      const { data: phases, error: phasesError } = await supabase
        .from('phases')
        .select('id, saison_id')
        .eq('saison_id', saison_id);

      if (phasesError) {
        console.error('Error fetching phases:', phasesError);
      } else if (phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        
        const { data: rosterData, error: rosterError } = await supabase
          .from('rosters')
          .select('coureur_id, manager_id, phase_id, managers(id, nom)')
          .in('phase_id', phaseIds)
          .in('coureur_id', riderIds);

        if (rosterError) {
          console.error('Error fetching rosters for season:', rosterError);
        } else if (rosterData) {
          console.log(`Found ${rosterData.length} roster entries for season`);
          // Build ownersMap with owners_all and owners_by_phase
          ownersMap = rosterData.reduce((acc: any, r: any) => {
            if (!acc[r.coureur_id]) {
              acc[r.coureur_id] = {
                owners_all: [],
                owners_by_phase: {}
              };
            }
            if (r.managers) {
              const owner = {
                manager_id: r.manager_id,
                manager_nom: r.managers.nom
              };
              // Add to owners_all if not already present
              if (!acc[r.coureur_id].owners_all.some((o: any) => o.manager_id === r.manager_id)) {
                acc[r.coureur_id].owners_all.push(owner);
              }
              // Add to owners_by_phase
              if (!acc[r.coureur_id].owners_by_phase[r.phase_id]) {
                acc[r.coureur_id].owners_by_phase[r.phase_id] = [];
              }
              acc[r.coureur_id].owners_by_phase[r.phase_id].push(owner);
            }
            return acc;
          }, {});
        }
      }
    }

    console.log(`Built owners map for ${Object.keys(ownersMap).length} riders`);

    // Map and enrich each item
    const mappedItems = items.map((item: any) => {
      const ownerData = ownersMap[item.rider_id] || {};
      // ✅ Utiliser prix_achat (SOMME des prix payés) au lieu de prix_initial (côte)
      const ratio = item.prix_achat > 0 
        ? Number((item.total_points / item.prix_achat).toFixed(2))
        : 0;

      return {
        rider_id: item.rider_id,
        rider_nom: item.rider_name,
        rider_equipe: item.rider_equipe,
        total_points: item.total_points,
        prix_achat: item.prix_achat,
        ratio_points_par_prix: ratio,
        courses_count: item.race_count,
        // Add owners based on context
        ...(phase_id 
          ? { owners: ownerData || [] }
          : { 
              owners_all: ownerData.owners_all || [],
              owners_by_phase: ownerData.owners_by_phase || {}
            }
        )
      };
    });

    return new Response(JSON.stringify({ items: mappedItems }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-top-riders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
