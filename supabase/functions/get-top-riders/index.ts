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

    const { saison_id, phase_id, league_id, limit = 5000, course_ids, categories } = await req.json();

    if (!league_id) {
      throw new Error('league_id is required');
    }

    const hasCourseFilter = Array.isArray(course_ids) && course_ids.length > 0;
    const hasCategoryFilter = Array.isArray(categories) && categories.length > 0;

    console.log('Fetching top riders with filters:', { saison_id, phase_id, league_id, limit, hasCourseFilter, hasCategoryFilter });

    // Resolve effective saison_id
    let effectiveSaisonId: string | null = saison_id ?? null;
    if (phase_id && !effectiveSaisonId) {
      const { data: phaseRow } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', phase_id)
        .maybeSingle();
      effectiveSaisonId = phaseRow?.saison_id ?? null;
    }

    let items: any[] = [];

    if (hasCourseFilter || hasCategoryFilter) {
      // ----- Custom filtered aggregation path -----
      const { data: leagueCourses, error: lcErr } = await supabase
        .rpc('get_league_course_ids', { p_league_id: league_id });
      if (lcErr) {
        console.error('Error fetching league course ids:', lcErr);
        throw lcErr;
      }
      let allowedCourseIds = new Set<string>(
        (leagueCourses || []).map((row: any) => row.course_id).filter(Boolean)
      );

      if (hasCourseFilter) {
        const explicit = new Set<string>(course_ids);
        allowedCourseIds = new Set([...allowedCourseIds].filter((id) => explicit.has(id)));
      }

      // Restrict to phase scope
      let phaseScopeQuery = supabase.from('courses').select('id, phase_id, categorie, date_debut');
      if (phase_id) {
        phaseScopeQuery = phaseScopeQuery.eq('phase_id', phase_id);
      } else if (effectiveSaisonId) {
        const { data: phasesForSeason } = await supabase
          .from('phases')
          .select('id')
          .eq('saison_id', effectiveSaisonId);
        const phaseIdsForSeason = (phasesForSeason || []).map((p: any) => p.id);
        if (phaseIdsForSeason.length === 0) {
          return new Response(JSON.stringify({ items: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        phaseScopeQuery = phaseScopeQuery.in('phase_id', phaseIdsForSeason);
      }
      const { data: scopedCourses, error: scErr } = await phaseScopeQuery.limit(5000);
      if (scErr) {
        console.error('Error fetching scoped courses:', scErr);
        throw scErr;
      }

      // Apply league started_at_effective
      const { data: leagueRow } = await supabase
        .from('leagues')
        .select('started_at_effective, created_at')
        .eq('id', league_id)
        .maybeSingle();
      const effectiveStart = leagueRow
        ? (leagueRow.started_at_effective || leagueRow.created_at)
        : null;
      const effectiveStartDate = effectiveStart ? new Date(effectiveStart) : null;

      const finalCourseIds: string[] = [];
      for (const co of scopedCourses || []) {
        if (!allowedCourseIds.has(co.id)) continue;
        if (hasCategoryFilter && !categories.includes(co.categorie)) continue;
        if (effectiveStartDate && co.date_debut && new Date(co.date_debut) < effectiveStartDate) continue;
        finalCourseIds.push(co.id);
      }

      console.log(`Filtered to ${finalCourseIds.length} courses for aggregation`);

      if (finalCourseIds.length === 0) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Aggregate points_ledger over filtered courses (paginated)
      const aggMap = new Map<string, { total_points: number; courses: Set<string> }>();
      const pageSize = 1000;
      const chunkSize = 200;
      for (let i = 0; i < finalCourseIds.length; i += chunkSize) {
        const chunk = finalCourseIds.slice(i, i + chunkSize);
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: page, error: plErr } = await supabase
            .from('points_ledger')
            .select('coureur_id, course_id, points')
            .in('course_id', chunk)
            .range(offset, offset + pageSize - 1);
          if (plErr) {
            console.error('Error fetching points_ledger page:', plErr);
            throw plErr;
          }
          if (!page || page.length === 0) {
            hasMore = false;
            break;
          }
          for (const row of page) {
            if (!row.coureur_id) continue;
            const entry = aggMap.get(row.coureur_id) || { total_points: 0, courses: new Set<string>() };
            entry.total_points += Number(row.points) || 0;
            if (row.course_id) entry.courses.add(row.course_id);
            aggMap.set(row.coureur_id, entry);
          }
          offset += pageSize;
          hasMore = page.length === pageSize;
        }
      }

      const aggRiderIds = [...aggMap.entries()]
        .filter(([, v]) => v.total_points > 0)
        .map(([id]) => id);

      if (aggRiderIds.length === 0) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Enrich with rider name + season-specific team + prix_initial
      const { data: ridersRows } = await supabase
        .from('coureurs')
        .select('id, nom, prix_initial')
        .in('id', aggRiderIds);

      const ridersMap = new Map<string, any>(
        (ridersRows || []).map((r: any) => [r.id, r])
      );

      const teamByRider = new Map<string, string>();
      const prixInitialByRider = new Map<string, number>();
      if (effectiveSaisonId) {
        const { data: csRows } = await supabase
          .from('coureurs_saisons')
          .select('coureur_id, prix_initial, equipe_id')
          .eq('saison_id', effectiveSaisonId)
          .in('coureur_id', aggRiderIds);
        const equipeIds = [...new Set((csRows || []).map((c: any) => c.equipe_id).filter(Boolean))];
        let equipeNameMap = new Map<string, string>();
        if (equipeIds.length > 0) {
          const { data: esRows } = await supabase
            .from('equipes_saisons')
            .select('equipe_id, nom_affiche')
            .eq('saison_id', effectiveSaisonId)
            .in('equipe_id', equipeIds);
          equipeNameMap = new Map((esRows || []).map((e: any) => [e.equipe_id, e.nom_affiche]));
        }
        for (const cs of csRows || []) {
          if (cs.equipe_id && equipeNameMap.has(cs.equipe_id)) {
            teamByRider.set(cs.coureur_id, equipeNameMap.get(cs.equipe_id)!);
          }
          if (cs.prix_initial != null) {
            prixInitialByRider.set(cs.coureur_id, Number(cs.prix_initial));
          }
        }
      }

      items = aggRiderIds
        .map((rid) => {
          const r = ridersMap.get(rid);
          const agg = aggMap.get(rid)!;
          return {
            coureur_id: rid,
            coureur_nom: r?.nom || rid,
            coureur_equipe: teamByRider.get(rid) || 'N/A',
            total_points: agg.total_points,
            courses_count: agg.courses.size,
            prix_initial: prixInitialByRider.get(rid) ?? Number(r?.prix_initial ?? 0),
            owner_manager_id: null,
            owner_manager_nom: null,
          };
        })
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, limit);
    } else {
      const { data: rpcItems, error } = await supabase
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
      items = rpcItems || [];
    }

    console.log(`Fetched ${items.length} top riders`);

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
          
          // Get winning bids for these rosters to get round numbers
          const rosterCoureurIds = [...new Set(allRosterData.map(r => r.coureur_id))];
          const { data: winningBids } = await supabase
            .from('bids')
            .select('coureur_id, round_number')
            .eq('league_id', league_id)
            .eq('statut', 'won')
            .in('coureur_id', rosterCoureurIds);
          
          const winningRoundsMap = Object.fromEntries(
            (winningBids || []).map(b => [b.coureur_id, b.round_number])
          );
          
          // Build ownersMap with owners_all, owners_by_phase, prix_signatures and winning_round
          ownersMap = allRosterData.reduce((acc: any, r: any) => {
            if (!acc[r.coureur_id]) {
              acc[r.coureur_id] = {
                owners_all: [],
                owners_by_phase: {},
                prix_signatures: [],
                winning_round: winningRoundsMap[r.coureur_id] || null
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
