import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError || !roles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { startlist_id, ratings } = await req.json();

    if (!startlist_id || !Array.isArray(ratings)) {
      return new Response(
        JSON.stringify({ error: 'startlist_id and ratings array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ratings
    for (const rating of ratings) {
      if (!rating.manager_id || typeof rating.stars !== 'number' || rating.stars < 1 || rating.stars > 5) {
        return new Response(
          JSON.stringify({ error: 'Each rating must have manager_id and stars (1-5)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Upsert ratings
    const ratingsToInsert = ratings.map(r => ({
      startlist_id,
      manager_id: r.manager_id,
      rated_by: user.id,
      stars: r.stars,
      note: r.note || null,
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError } = await supabase
      .from('startlist_manager_ratings')
      .upsert(ratingsToInsert, {
        onConflict: 'startlist_id,manager_id,rated_by'
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: `Failed to save ratings: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch updated ratings aggregated
    const { data: updatedRatings, error: fetchError } = await supabase
      .from('startlist_manager_ratings')
      .select('manager_id, stars')
      .eq('startlist_id', startlist_id);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch ratings: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate aggregates
    const aggregated = updatedRatings.reduce((acc, r) => {
      if (!acc[r.manager_id]) {
        acc[r.manager_id] = { stars: [], count: 0 };
      }
      acc[r.manager_id].stars.push(r.stars);
      acc[r.manager_id].count++;
      return acc;
    }, {} as Record<string, { stars: number[], count: number }>);

    const result = Object.entries(aggregated).map(([managerId, data]) => ({
      manager_id: managerId,
      avg_stars: data.stars.reduce((sum, s) => sum + s, 0) / data.count,
      votes: data.count
    }));

    return new Response(
      JSON.stringify({ ratings: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
