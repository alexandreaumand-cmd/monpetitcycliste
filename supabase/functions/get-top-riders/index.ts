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
    
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create client with user's JWT for proper RLS context
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { saison_id, phase_id, league_id, limit = 5000 } = await req.json();

    if (!league_id) {
      throw new Error('league_id is required');
    }

    console.log('Fetching top riders with filters:', { saison_id, phase_id, league_id, limit });

    // Call the optimized PostgreSQL RPC function
    const { data: items, error } = await supabase
      .rpc('get_top_riders_optimized', {
        p_saison_id: saison_id,
        p_phase_id: phase_id,
        p_league_id: league_id,
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
    const riderIds = [...new Set(items.map((item: any) => item.coureur_id))];

    // Fetch owner information
    let ownersMap: Record<string, any> = {};
    
    if (phase_id) {
      // Single phase context: query ALL rosters for this phase with league filter
      const rosterQuery = supabase
        .from('rosters')
        .select('coureur_id, manager_id, prix_signature')
        .eq('phase_id', phase_id)
        .eq('league_id', league_id);
      
      const { data: rosterData, error: rosterError } = await rosterQuery.limit(5000);

      if (rosterError) {
        console.error('Error fetching rosters:', rosterError);
      } else if (rosterData && rosterData.length > 0) {
        console.log(`Found ${rosterData.length} roster entries for phase`);
        
        // Extract unique manager IDs and fetch managers separately
        const managerIds = [...new Set(rosterData.map(r => r.manager_id).filter(Boolean))];
        const { data: managers } = await supabase
          .from('managers')
          .select('id, nom')
          .in('id', managerIds);
        
        const managersMap = Object.fromEntries((managers || []).map(m => [m.id, m.nom]));
        
        // Get winning bids for these rosters to get round numbers
        const rosterCoureurIds = [...new Set(rosterData.map(r => r.coureur_id))];
        const { data: winningBids } = await supabase
          .from('bids')
          .select('coureur_id, round_number')
          .eq('league_id', league_id)
          .eq('statut', 'won')
          .in('coureur_id', rosterCoureurIds);
        
        const winningRoundsMap = Object.fromEntries(
          (winningBids || []).map(b => [b.coureur_id, b.round_number])
        );
        
        ownersMap = rosterData.reduce((acc: any, r: any) => {
          if (!acc[r.coureur_id]) {
            acc[r.coureur_id] = {
              owners: [],
              prix_signatures: [],
              winning_round: winningRoundsMap[r.coureur_id] || null
            };
          }
          if (r.manager_id && managersMap[r.manager_id]) {
            acc[r.coureur_id].owners.push({
              manager_id: r.manager_id,
              manager_nom: managersMap[r.manager_id]
            });
          }
          if (r.prix_signature) {
            acc[r.coureur_id].prix_signatures.push(Number(r.prix_signature));
          }
          return acc;
        }, {});
      }
    } else {
      // Season context: fetch all phases and ALL rosters with league filter
      const { data: phases, error: phasesError } = await supabase
        .from('phases')
        .select('id, saison_id, index_dans_saison')
        .eq('saison_id', saison_id);

      if (phasesError) {
        console.error('Error fetching phases:', phasesError);
      } else if (phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        
        // Fetch ALL rosters for these phases using pagination to bypass default limits
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;
        const allRosterData: any[] = [];

        while (hasMore) {
          const rosterPageQuery = supabase
            .from('rosters')
            .select('coureur_id, manager_id, phase_id, prix_signature')
            .in('phase_id', phaseIds)
            .eq('league_id', league_id);
          
          const { data: page, error: rosterError } = await rosterPageQuery
            .range(offset, offset + pageSize - 1);

          if (rosterError) {
            console.error('Error fetching rosters for season (page):', rosterError);
            break;
          }

          if (page && page.length > 0) {
            allRosterData.push(...page);
            offset += pageSize;
            hasMore = page.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        if (allRosterData && allRosterData.length > 0) {
          console.log(`Found ${allRosterData.length} roster entries for season`);
          
          // Extract unique manager IDs and fetch managers separately
          const managerIds = [...new Set(allRosterData.map(r => r.manager_id).filter(Boolean))];
          
          const { data: managers } = await supabase
            .from('managers')
            .select('id, nom')
            .in('id', managerIds);
          
          const managersMap = Object.fromEntries((managers || []).map(m => [m.id, m.nom]));
          
          // Build ownersMap with owners_all, owners_by_phase and prix_signatures
          ownersMap = allRosterData.reduce((acc: any, r: any) => {
            if (!acc[r.coureur_id]) {
              acc[r.coureur_id] = {
                owners_all: [],
                owners_by_phase: {},
                prix_signatures: []
              };
            }
            
            if (r.manager_id && managersMap[r.manager_id]) {
              const owner = {
                manager_id: r.manager_id,
                manager_nom: managersMap[r.manager_id]
              };
              
              // Add to owners_all if not already present
              if (!acc[r.coureur_id].owners_all.some((o: any) => o.manager_id === r.manager_id)) {
                acc[r.coureur_id].owners_all.push(owner);
              }
              
              // Add to owners_by_phase with phase index
              const phaseInfo = phases.find(p => p.id === r.phase_id);
              const phaseKey = phaseInfo ? `P${phaseInfo.index_dans_saison}` : r.phase_id;
              
              if (!acc[r.coureur_id].owners_by_phase[phaseKey]) {
                acc[r.coureur_id].owners_by_phase[phaseKey] = [];
              }
              acc[r.coureur_id].owners_by_phase[phaseKey].push(owner);
            }
            
            if (r.prix_signature) {
              acc[r.coureur_id].prix_signatures.push(Number(r.prix_signature));
            }
            
            return acc;
          }, {});
          
          // Debug logging for specific riders
          if (ownersMap['tadej_pogacar']) {
            console.log('POGACAR owners:', JSON.stringify(ownersMap['tadej_pogacar']));
          }
          if (ownersMap['jonas_vingegaard']) {
            console.log('VINGEGAARD owners:', JSON.stringify(ownersMap['jonas_vingegaard']));
          }
        }
      }
    }

    console.log(`Built owners map for ${Object.keys(ownersMap).length} riders`);

    // Map and enrich each item
    const mappedItems = items.map((item: any) => {
      const ownerData = ownersMap[item.coureur_id] || (phase_id ? { owners: [], prix_signatures: [] } : { owners_all: [], owners_by_phase: {}, prix_signatures: [] });
      const prixInitial = Number(item.prix_initial) || 0;
      
      // Calculate prix_achat from prix_signatures
      const prixAchat = ownerData.prix_signatures && ownerData.prix_signatures.length > 0
        ? Math.max(...ownerData.prix_signatures)
        : prixInitial;
      
      const ratio = item.total_points > 0 && prixAchat > 0
        ? Number((item.total_points / prixAchat).toFixed(2))
        : 0;

      return {
        rider_id: item.coureur_id,
        rider_nom: item.coureur_nom,
        rider_equipe: item.coureur_equipe,
        total_points: item.total_points,
        prix_achat: prixAchat,
        cote_initiale: prixInitial,
        ratio_points_par_prix: ratio,
        courses_count: item.courses_count,
        winning_round: ownerData.winning_round || null,
        // Add owners based on context
        ...(phase_id 
          ? { owners: ownerData.owners || [] }
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
