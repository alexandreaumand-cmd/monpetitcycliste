import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-rider-upcoming-races function loaded');

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

    const { rider_id } = await req.json();

    if (!rider_id) {
      throw new Error('rider_id is required');
    }

    console.log('Fetching upcoming races for rider:', rider_id);

    const today = new Date().toISOString().split('T')[0];

    // Step 1: Get all future races with their latest startlist import
    const { data: latestStartlists, error: latestError } = await supabase
      .from('startlist_imports')
      .select(`
        id,
        race_id,
        pcs_validated,
        created_at,
        courses!inner(
          id,
          nom,
          categorie,
          date_debut,
          date_fin
        )
      `)
      .gte('courses.date_debut', today)
      .order('created_at', { ascending: false });

    if (latestError) {
      console.error('Error fetching latest startlists:', latestError);
      throw latestError;
    }

    // Build a map of race_id -> latest startlist_id
    const latestStartlistByRace = new Map<string, string>();
    const startlistInfoMap = new Map<string, any>();
    
    for (const sl of latestStartlists || []) {
      const raceId = sl.race_id;
      if (!latestStartlistByRace.has(raceId)) {
        latestStartlistByRace.set(raceId, sl.id);
        startlistInfoMap.set(sl.id, sl);
      }
    }

    const latestStartlistIds = Array.from(latestStartlistByRace.values());

    if (latestStartlistIds.length === 0) {
      console.log('No future startlists found');
      return new Response(JSON.stringify({ races: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Check if rider exists in any of these latest startlists
    const { data: riderEntries, error: entriesError } = await supabase
      .from('startlist_entries')
      .select('startlist_id')
      .eq('coureur_id', rider_id)
      .in('startlist_id', latestStartlistIds);

    if (entriesError) {
      console.error('Error fetching rider entries:', entriesError);
      throw entriesError;
    }

    console.log(`Found ${riderEntries?.length || 0} entries for rider ${rider_id} in latest startlists`);

    // Step 3: Build final race list from rider's entries in latest startlists only
    const races = (riderEntries || []).map((entry: any) => {
      const startlistInfo = startlistInfoMap.get(entry.startlist_id);
      if (!startlistInfo) return null;
      
      const course = startlistInfo.courses;
      return {
        race_id: course.id,
        race_nom: course.nom,
        categorie: course.categorie,
        date_debut: course.date_debut,
        date_fin: course.date_fin,
        is_confirmed: startlistInfo.pcs_validated,
      };
    }).filter(Boolean);

    // Sort by date_debut ascending
    races.sort((a: any, b: any) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());

    console.log(`Returning ${races.length} upcoming races for rider ${rider_id}`);

    return new Response(JSON.stringify({ races }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-rider-upcoming-races:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
