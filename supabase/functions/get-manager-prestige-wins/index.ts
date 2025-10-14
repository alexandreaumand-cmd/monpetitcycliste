import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-manager-prestige-wins function loaded');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { phase_id, saison_id } = await req.json();

    console.log('Fetching prestige wins with filters:', { phase_id, saison_id });

    // Determine which phases to consider
    let targetPhaseIds: string[] = [];
    if (phase_id) {
      targetPhaseIds = [phase_id];
    } else if (saison_id) {
      const { data: phaseIds } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phaseIds && phaseIds.length > 0) {
        targetPhaseIds = phaseIds.map(p => p.id);
      }
    }

    // Step 1: Get all prestige courses with their phase_id
    const { data: prestigeCourses, error: coursesError } = await supabase
      .from('courses')
      .select('id, nom, categorie, phase_id')
      .in('categorie', ['WT GT', 'WT Monument', 'WC RR', 'WC ITT'])
      .in('phase_id', targetPhaseIds);

    if (coursesError) {
      console.error('Error fetching prestige courses:', coursesError);
      throw coursesError;
    }

    if (!prestigeCourses || prestigeCourses.length === 0) {
      console.log('No prestige courses found for filters');
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const courseIds = prestigeCourses.map(c => c.id);
    
    // Step 2: Get race results for winners (position 1, General classification)
    const { data: resultsData, error: resultsError } = await supabase
      .from('race_results')
      .select('course_id, coureur_id, type_classement')
      .in('course_id', courseIds)
      .eq('position', 1)
      .eq('statut', 'finished')
      .eq('type_classement', 'General');
    
    console.log('Race results found:', resultsData?.length);

    if (resultsError) {
      console.error('Error fetching results:', resultsError);
      throw resultsError;
    }

    if (!resultsData || resultsData.length === 0) {
      console.log('No prestige wins found');
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: For each victory, check which managers owned the winning rider during that course's phase
    const prestigeMap = new Map<string, {
      hasTourDeFrance: boolean;
      hasGiro: boolean;
      hasVuelta: boolean;
      monuments: string[];
      worldChampionships: {
        hasRR: boolean;
        hasITT: boolean;
        names: string[];
      };
    }>();

    // Process each prestige victory
    for (const result of resultsData) {
      const course = prestigeCourses.find(c => c.id === result.course_id);
      if (!course || !course.phase_id) continue;

      // Find which managers owned this rider during this course's phase
      const { data: owners, error: ownersError } = await supabase
        .from('rosters')
        .select('manager_id')
        .eq('coureur_id', result.coureur_id)
        .eq('phase_id', course.phase_id);

      if (ownersError) {
        console.error('Error fetching owners:', ownersError);
        continue;
      }

      if (!owners || owners.length === 0) continue;

      // Attribute the prestige win to each manager who owned the rider
      for (const owner of owners) {
        const managerId = owner.manager_id;
        if (!managerId) continue;

        if (!prestigeMap.has(managerId)) {
          prestigeMap.set(managerId, {
            hasTourDeFrance: false,
            hasGiro: false,
            hasVuelta: false,
            monuments: [],
            worldChampionships: {
              hasRR: false,
              hasITT: false,
              names: [],
            },
          });
        }

        const prestige = prestigeMap.get(managerId)!;

        // Grand Tours
        if (course.categorie === 'WT GT') {
          if (course.nom?.toLowerCase().includes('tour de france')) {
            prestige.hasTourDeFrance = true;
          } else if (course.nom?.toLowerCase().includes('giro')) {
            prestige.hasGiro = true;
          } else if (course.nom?.toLowerCase().includes('vuelta')) {
            prestige.hasVuelta = true;
          }
        }

        // Monuments - store each monument name
        if (course.categorie === 'WT Monument') {
          if (!prestige.monuments.includes(course.nom)) {
            prestige.monuments.push(course.nom);
          }
        }

        // World Championships - distinguish RR and ITT
        if (course.categorie === 'WC RR') {
          prestige.worldChampionships.hasRR = true;
          if (!prestige.worldChampionships.names.includes(course.nom)) {
            prestige.worldChampionships.names.push(course.nom);
          }
        } else if (course.categorie === 'WC ITT') {
          prestige.worldChampionships.hasITT = true;
          if (!prestige.worldChampionships.names.includes(course.nom)) {
            prestige.worldChampionships.names.push(course.nom);
          }
        }
      }
    }

    // Convert map to object
    const result: Record<string, any> = {};
    prestigeMap.forEach((value, key) => {
      result[key] = value;
    });

    console.log(`Returning prestige data for ${Object.keys(result).length} managers`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-manager-prestige-wins:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
