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
          pcs_validated,
          created_at,
          courses!inner(
            id,
            nom,
            date_debut,
            date_fin
          )
        )
      `)
      .eq('coureur_id', rider_id)
      .gte('startlist_imports.courses.date_debut', new Date().toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching upcoming races:', error);
      throw error;
    }

    console.log(`Found ${races?.length || 0} raw entries for rider ${rider_id}`);

    // Transform the data to flatten the structure and add is_confirmed from pcs_validated
    const transformedRaces = races?.map((entry: any) => ({
      race_id: entry.startlist_imports.courses.id,
      race_nom: entry.startlist_imports.courses.nom,
      date_debut: entry.startlist_imports.courses.date_debut,
      date_fin: entry.startlist_imports.courses.date_fin,
      is_confirmed: entry.startlist_imports.pcs_validated,
      created_at: entry.startlist_imports.created_at
    })) || [];

    // Remove duplicates and keep the most recent startlist for each race
    const uniqueRaces = transformedRaces.reduce((acc: any[], race: any) => {
      const existing = acc.find(r => r.race_id === race.race_id);
      if (!existing) {
        acc.push(race);
      } else if (new Date(race.created_at) > new Date(existing.created_at)) {
        // Keep the most recent startlist (by created_at)
        const index = acc.findIndex(r => r.race_id === race.race_id);
        acc[index] = race;
      }
      return acc;
    }, []);

    // Remove created_at from final output (not needed in frontend)
    const cleanedRaces = uniqueRaces.map(({ created_at, ...race }) => race);

    // Sort by date_debut ascending (client-side sorting)
    cleanedRaces.sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());

    console.log(`Returning ${cleanedRaces.length} unique upcoming races`);

    return new Response(JSON.stringify({ races: cleanedRaces }), {
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
