import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { course_id } = await req.json();

    if (!course_id) {
      return new Response(
        JSON.stringify({ error: 'course_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Getting rider totals for course:', course_id);

    // Get course info to find phase_id
    const { data: course, error: courseError } = await supabaseClient
      .from('courses')
      .select('id, phase_id')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Course not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all points for this course from points_ledger
    const { data: ledgerData, error: ledgerError } = await supabaseClient
      .from('points_ledger')
      .select('coureur_id, type_classement, etape_numero, points')
      .eq('course_id', course_id);

    if (ledgerError) throw ledgerError;

    // Aggregate points by rider
    const riderPointsMap = new Map<string, number>();
    const breakdown: Array<{
      coureur_id: string;
      type_classement: string;
      etape_numero: number | null;
      points: number;
    }> = [];

    for (const entry of ledgerData || []) {
      const current = riderPointsMap.get(entry.coureur_id) || 0;
      riderPointsMap.set(entry.coureur_id, current + entry.points);
      
      breakdown.push({
        coureur_id: entry.coureur_id,
        type_classement: entry.type_classement,
        etape_numero: entry.etape_numero,
        points: entry.points,
      });
    }

    // Get rider details
    const riderIds = Array.from(riderPointsMap.keys());
    
    let riders: Array<{ id: string; nom: string; equipe: string | null }> = [];
    if (riderIds.length > 0) {
      const { data: ridersData, error: ridersError } = await supabaseClient
        .from('coureurs')
        .select('id, nom, equipe')
        .in('id', riderIds);

      if (ridersError) throw ridersError;
      riders = ridersData || [];
    }

    const riderMap = new Map(riders.map(r => [r.id, r]));

    // Build ranked list
    const rankedRiders = Array.from(riderPointsMap.entries())
      .map(([coureur_id, total_points]) => {
        const rider = riderMap.get(coureur_id);
        return {
          coureur_id,
          coureur_nom: rider?.nom || 'Unknown',
          equipe: rider?.equipe || '',
          total_points,
        };
      })
      .sort((a, b) => b.total_points - a.total_points)
      .map((rider, index) => ({
        rank: index + 1,
        ...rider,
      }));

    console.log(`Found ${rankedRiders.length} riders with points`);

    return new Response(
      JSON.stringify({ riders: rankedRiders, breakdown }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in rider-course-total:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
