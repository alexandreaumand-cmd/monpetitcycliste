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

    // Step 1: Get all prestige courses and their winners
    const { data: prestigeCourses, error: coursesError } = await supabase
      .from('courses')
      .select('id, nom, categorie')
      .in('categorie', ['WT GT', 'WT Monument', 'WC RR', 'WC ITT']);

    if (coursesError) {
      console.error('Error fetching prestige courses:', coursesError);
      throw coursesError;
    }

    const courseIds = prestigeCourses?.map(c => c.id) || [];
    
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

    // Step 3: Get points_ledger to map coureurs to managers
    let pointsQuery = supabase
      .from('points_ledger')
      .select('manager_id, coureur_id, course_id')
      .in('course_id', courseIds)
      .not('manager_id', 'is', null);

    // Apply filters
    if (phase_id) {
      pointsQuery = pointsQuery.eq('phase_id', phase_id);
    } else if (saison_id) {
      const { data: phaseIds } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      
      if (phaseIds && phaseIds.length > 0) {
        pointsQuery = pointsQuery.in('phase_id', phaseIds.map(p => p.id));
      }
    }

    const { data: pointsData, error: pointsError } = await pointsQuery;

    if (pointsError) {
      console.error('Error fetching points data:', pointsError);
      throw pointsError;
    }

    // Build maps
    const courseMap = new Map<string, any>();
    prestigeCourses?.forEach(course => {
      courseMap.set(course.id, course);
    });

    const courseWinners = new Map<string, Set<string>>();
    resultsData?.forEach(result => {
      if (!courseWinners.has(result.course_id)) {
        courseWinners.set(result.course_id, new Set());
      }
      courseWinners.get(result.course_id)!.add(result.coureur_id);
    });

    // Calculate prestige wins per manager
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

    pointsData?.forEach(point => {
      if (!point.manager_id) return;

      const course = courseMap.get(point.course_id);
      if (!course) return;

      const winners = courseWinners.get(point.course_id);
      if (!winners || !winners.has(point.coureur_id)) return;

      if (!prestigeMap.has(point.manager_id)) {
        prestigeMap.set(point.manager_id, {
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

      const prestige = prestigeMap.get(point.manager_id)!;

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
    });

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
