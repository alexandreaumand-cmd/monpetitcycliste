import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
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

    // Query to get upcoming races for the rider
    const { data: races, error } = await supabase
      .from('startlist_entries')
      .select(`
        startlist_id,
        status,
        startlist_imports!inner(
          race_id,
          courses!inner(
            id,
            nom,
            date_debut,
            date_fin
          )
        )
      `)
      .eq('coureur_id', rider_id)
      .gte('startlist_imports.courses.date_debut', new Date().toISOString().split('T')[0])
      .order('startlist_imports.courses.date_debut', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming races:', error);
      throw error;
    }

    // Transform the data to flatten the structure and add is_confirmed
    const transformedRaces = races?.map((entry: any) => ({
      race_id: entry.startlist_imports.courses.id,
      race_nom: entry.startlist_imports.courses.nom,
      date_debut: entry.startlist_imports.courses.date_debut,
      date_fin: entry.startlist_imports.courses.date_fin,
      is_confirmed: entry.status === 'confirmed'
    })) || [];

    // Remove duplicates (same race can appear multiple times if multiple startlists)
    const uniqueRaces = transformedRaces.reduce((acc: any[], race: any) => {
      const existing = acc.find(r => r.race_id === race.race_id);
      if (!existing) {
        acc.push(race);
      } else if (race.is_confirmed && !existing.is_confirmed) {
        // If we find a confirmed version of a race, replace the unconfirmed one
        const index = acc.findIndex(r => r.race_id === race.race_id);
        acc[index] = race;
      }
      return acc;
    }, []);

    console.log(`Returning ${uniqueRaces.length} upcoming races`);

    return new Response(JSON.stringify({ races: uniqueRaces }), {
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
