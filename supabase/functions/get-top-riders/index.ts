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

    const { saison_id, phase_id, limit = 20 } = await req.json();

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
          equipe
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
      total_points: rider.total_points,
      courses_count: rider.courses_count.size,
    }));

    // Sort by points descending
    items.sort((a, b) => b.total_points - a.total_points);

    // Limit results
    items = items.slice(0, limit);

    // Fetch owners if phase_id is provided
    if (phase_id) {
      const riderIds = items.map(r => r.rider_id);
      
      const { data: rostersData, error: rostersError } = await supabase
        .from('rosters')
        .select(`
          coureur_id,
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
        // Map owners to riders
        const ownersMap = new Map();
        rostersData?.forEach((roster: any) => {
          if (!ownersMap.has(roster.coureur_id)) {
            ownersMap.set(roster.coureur_id, []);
          }
          ownersMap.get(roster.coureur_id).push({
            manager_id: roster.managers?.id,
            manager_nom: roster.managers?.nom || 'Inconnu',
          });
        });

        items = items.map(rider => ({
          ...rider,
          owners: ownersMap.get(rider.rider_id) || [],
        }));
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
