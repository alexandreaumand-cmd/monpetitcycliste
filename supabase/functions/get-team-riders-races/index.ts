import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-team-riders-races function loaded');

interface Race {
  race_id: string;
  race_nom: string;
  categorie: string | null;
  date_debut: string;
  date_fin: string;
}

interface RiderRaces {
  current_races: Race[];
  upcoming_races: Race[];
}

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

    const { rider_ids } = await req.json();

    if (!rider_ids || !Array.isArray(rider_ids) || rider_ids.length === 0) {
      return new Response(JSON.stringify({ races_by_rider: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching races for riders:', rider_ids.length);

    const today = new Date().toISOString().split('T')[0];
    const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Step 1: Get all startlist imports for current/upcoming races, ordered by created_at desc
    const { data: allStartlists, error: startlistError } = await supabase
      .from('startlist_imports')
      .select(`
        id,
        race_id,
        created_at,
        courses!inner(
          id,
          nom,
          categorie,
          date_debut,
          date_fin
        )
      `)
      .lte('courses.date_debut', in10Days)
      .gte('courses.date_fin', today)
      .order('created_at', { ascending: false });

    if (startlistError) {
      console.error('Error fetching startlists:', startlistError);
      throw startlistError;
    }

    // Step 2: Build a map of race_id -> latest startlist_id (first one wins since ordered desc)
    const latestStartlistByRace = new Map<string, string>();
    const startlistInfoMap = new Map<string, any>();
    
    for (const sl of allStartlists || []) {
      const raceId = sl.race_id;
      if (!latestStartlistByRace.has(raceId)) {
        latestStartlistByRace.set(raceId, sl.id);
        startlistInfoMap.set(sl.id, sl);
      }
    }

    const latestStartlistIds = Array.from(latestStartlistByRace.values());

    if (latestStartlistIds.length === 0) {
      console.log('No current/upcoming startlists found');
      return new Response(JSON.stringify({ races_by_rider: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${latestStartlistIds.length} latest startlists for current/upcoming races`);

    // Step 3: Query startlist entries for all riders, but ONLY in the latest startlists
    const { data: entries, error } = await supabase
      .from('startlist_entries')
      .select('coureur_id, startlist_id')
      .in('coureur_id', rider_ids)
      .in('startlist_id', latestStartlistIds);

    if (error) {
      console.error('Error fetching entries:', error);
      throw error;
    }

    console.log(`Found ${entries?.length || 0} startlist entries in latest startlists`);

    // Group races by rider
    const racesByRider: Record<string, RiderRaces> = {};

    // Initialize all rider_ids with empty arrays
    for (const riderId of rider_ids) {
      racesByRider[riderId] = {
        current_races: [],
        upcoming_races: []
      };
    }

    // Process entries - only from latest startlists
    if (entries) {
      // Use a map to deduplicate races per rider
      const seenRaces: Record<string, Set<string>> = {};
      
      for (const entry of entries) {
        const riderId = entry.coureur_id;
        const startlistInfo = startlistInfoMap.get(entry.startlist_id);
        
        if (!startlistInfo) continue;
        
        const course = startlistInfo.courses;
        if (!course || !course.id) continue;
        
        // Initialize seen races set for this rider
        if (!seenRaces[riderId]) {
          seenRaces[riderId] = new Set();
        }
        
        // Skip if we've already processed this race for this rider
        if (seenRaces[riderId].has(course.id)) continue;
        seenRaces[riderId].add(course.id);
        
        const race: Race = {
          race_id: course.id,
          race_nom: course.nom,
          categorie: course.categorie,
          date_debut: course.date_debut,
          date_fin: course.date_fin
        };

        const raceStart = new Date(course.date_debut);
        const raceEnd = new Date(course.date_fin);
        const todayDate = new Date(today);

        // Check if race is current (today is between start and end)
        if (raceStart <= todayDate && todayDate <= raceEnd) {
          racesByRider[riderId].current_races.push(race);
        }
        // Check if race is upcoming (starts after today but within 10 days)
        else if (raceStart > todayDate) {
          racesByRider[riderId].upcoming_races.push(race);
        }
      }
    }

    // Sort races by date
    for (const riderId of Object.keys(racesByRider)) {
      racesByRider[riderId].current_races.sort((a, b) => 
        new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
      );
      racesByRider[riderId].upcoming_races.sort((a, b) => 
        new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
      );
    }

    console.log('Returning races for', Object.keys(racesByRider).length, 'riders');

    return new Response(JSON.stringify({ races_by_rider: racesByRider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-team-riders-races:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
