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

    // Build query for top riders
    let query = supabase
      .from('points_ledger')
      .select(`
        coureur_id,
        points,
        course_id,
        phase_id,
        coureurs:coureur_id (
          nom,
          equipe,
          prix_initial
        )
      `);

    // Apply filters
    if (phase_id) {
      query = query.eq('phase_id', phase_id);
    } else if (saison_id) {
      // Join with phases to filter by saison
      const { data: phases } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        query = query.in('phase_id', phaseIds);
      }
    }

    const { data: ledgerData, error: ledgerError } = await query;

    if (ledgerError) {
      console.error('Error fetching ledger data:', ledgerError);
      throw ledgerError;
    }

    // Aggregate by coureur_id
    const ridersMap = new Map();
    
    ledgerData?.forEach((entry: any) => {
      const coureurId = entry.coureur_id;
      
      if (!ridersMap.has(coureurId)) {
        ridersMap.set(coureurId, {
          rider_id: coureurId,
          rider_nom: entry.coureurs?.nom || 'Inconnu',
          rider_equipe: entry.coureurs?.equipe || '',
          prix_initial: entry.coureurs?.prix_initial || 0,
          total_points: 0,
          courses_count: new Set(),
        });
      }
      
      const rider = ridersMap.get(coureurId);
      rider.total_points += entry.points || 0;
      rider.courses_count.add(entry.course_id);
    });

    // Convert to array and format
    let items = Array.from(ridersMap.values()).map((rider: any) => ({
      rider_id: rider.rider_id,
      rider_nom: rider.rider_nom,
      rider_equipe: rider.rider_equipe,
      prix_achat: 0, // Will be filled later based on context
      total_points: rider.total_points,
      courses_count: rider.courses_count.size,
      ratio_points_par_prix: 0, // Will be calculated later with actual prix_achat
    }));

    // Sort by points descending
    items.sort((a, b) => b.total_points - a.total_points);

    // Limit results
    items = items.slice(0, limit);

    // Fetch owners based on phase_id
    if (phase_id) {
      // Case A: Specific phase - get owners for that phase only
      const riderIds = items.map(r => r.rider_id);
      
      const { data: rostersData, error: rostersError } = await supabase
        .from('rosters')
        .select(`
          coureur_id,
          prix_signature,
          managers:manager_id (
            id,
            nom
          )
        `)
        .eq('phase_id', phase_id)
        .in('coureur_id', riderIds);

      if (rostersError) {
        console.error('Error fetching rosters:', rostersError);
      } else {
        const ownersMap = new Map();
        const prixMap = new Map();
        
        rostersData?.forEach((roster: any) => {
          if (!ownersMap.has(roster.coureur_id)) {
            ownersMap.set(roster.coureur_id, []);
          }
          ownersMap.get(roster.coureur_id).push({
            manager_id: roster.managers?.id,
            manager_nom: roster.managers?.nom || 'Inconnu',
          });
          
          // Store prix_signature for this rider
          prixMap.set(roster.coureur_id, roster.prix_signature || 0);
        });

        items = items.map(rider => {
          const prix_achat = prixMap.get(rider.rider_id) || 0;
          return {
            ...rider,
            prix_achat,
            ratio_points_par_prix: prix_achat > 0 
              ? Math.round((rider.total_points / prix_achat) * 100) / 100
              : 0,
            owners: ownersMap.get(rider.rider_id) || [],
          };
        });
      }
    } else {
      // Case B: All phases - get deduplicated owners + owners by phase
      const riderIds = items.map(r => r.rider_id);
      
      // Build query for rosters
      let rostersQuery = supabase
        .from('rosters')
        .select(`
          coureur_id,
          phase_id,
          prix_signature,
          managers:manager_id (
            id,
            nom
          ),
          phases:phase_id (
            id,
            index_dans_saison,
            saison_id
          )
        `)
        .in('coureur_id', riderIds);

      // Filter by saison if provided
      if (saison_id) {
        const { data: phases } = await supabase
          .from('phases')
          .select('id')
          .eq('saison_id', saison_id);
        
        if (phases && phases.length > 0) {
          const phaseIds = phases.map(p => p.id);
          rostersQuery = rostersQuery.in('phase_id', phaseIds);
        }
      }

      const { data: rostersData, error: rostersError } = await rostersQuery;

      if (rostersError) {
        console.error('Error fetching rosters for all phases:', rostersError);
      } else {
        // Build owners_all (deduplicated), owners_by_phase, and sum of prix_signature
        const ownersAllMap = new Map();
        const ownersByPhaseMap = new Map();
        const prixTotalMap = new Map();

        rostersData?.forEach((roster: any) => {
          const coureurId = roster.coureur_id;
          const managerId = roster.managers?.id;
          const managerNom = roster.managers?.nom || 'Inconnu';
          const phaseId = roster.phase_id;
          const phaseIndex = roster.phases?.index_dans_saison;
          const prixSignature = roster.prix_signature || 0;

          // Initialize maps if not exists
          if (!ownersAllMap.has(coureurId)) {
            ownersAllMap.set(coureurId, new Map());
          }
          if (!ownersByPhaseMap.has(coureurId)) {
            ownersByPhaseMap.set(coureurId, []);
          }
          if (!prixTotalMap.has(coureurId)) {
            prixTotalMap.set(coureurId, 0);
          }

          // Add to owners_all (deduplicated by manager_id)
          if (!ownersAllMap.get(coureurId).has(managerId)) {
            ownersAllMap.get(coureurId).set(managerId, {
              manager_id: managerId,
              manager_nom: managerNom,
            });
          }

          // Add to owners_by_phase
          ownersByPhaseMap.get(coureurId).push({
            manager_id: managerId,
            manager_nom: managerNom,
            phase_id: phaseId,
            phase_index: phaseIndex,
          });

          // Sum prix_signature
          prixTotalMap.set(coureurId, prixTotalMap.get(coureurId) + prixSignature);
        });

        items = items.map(rider => {
          const ownersAllSet = ownersAllMap.get(rider.rider_id);
          const ownersByPhase = ownersByPhaseMap.get(rider.rider_id) || [];
          const prix_achat = prixTotalMap.get(rider.rider_id) || 0;

          return {
            ...rider,
            prix_achat,
            ratio_points_par_prix: prix_achat > 0 
              ? Math.round((rider.total_points / prix_achat) * 100) / 100
              : 0,
            owners_all: ownersAllSet ? Array.from(ownersAllSet.values()).sort((a: any, b: any) => 
              a.manager_nom.localeCompare(b.manager_nom)
            ) : [],
            owners_by_phase: ownersByPhase.sort((a: any, b: any) => {
              // Sort by manager name first, then by phase index
              const nameCompare = a.manager_nom.localeCompare(b.manager_nom);
              if (nameCompare !== 0) return nameCompare;
              return (a.phase_index || 0) - (b.phase_index || 0);
            }),
          };
        });
      }
    }

    console.log(`Returning ${items.length} top riders`);

    return new Response(JSON.stringify({ items }), {
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
