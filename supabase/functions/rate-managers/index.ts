import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    // Get current manager for author tracking
    const { data: currentManager, error: managerError } = await supabase
      .from('managers')
      .select('id, nom')
      .eq('user_id', user.id)
      .single();

    if (managerError || !currentManager) {
      return new Response(
        JSON.stringify({ error: 'Manager profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { startlist_id, ratings = [], global_note = undefined, league_id } = await req.json();

    console.log('rate-managers payload', {
      startlist_id,
      league_id,
      ratings_len: Array.isArray(ratings) ? ratings.length : 'n/a',
      has_global: typeof global_note,
      preview: typeof global_note === 'string' ? global_note.slice(0, 60) : null,
    });

    if (!startlist_id || !Array.isArray(ratings) || !league_id) {
      return new Response(
        JSON.stringify({ error: 'startlist_id, league_id and ratings array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch race_id from startlist_imports to use for notes (persistent across reimports)
    const { data: startlistData, error: startlistError } = await supabase
      .from('startlist_imports')
      .select('race_id')
      .eq('id', startlist_id)
      .single();

    if (startlistError || !startlistData?.race_id) {
      return new Response(
        JSON.stringify({ error: 'Startlist not found or missing race_id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const raceId = startlistData.race_id;

    // Validate ratings
    for (const rating of ratings) {
      if (!rating.manager_id || typeof rating.stars !== 'number' || rating.stars < 1 || rating.stars > 5) {
        return new Response(
          JSON.stringify({ error: 'Each rating must have manager_id and stars (1-5)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Upsert ratings with league_id
    const ratingsToInsert = ratings.map(r => ({
      startlist_id,
      manager_id: r.manager_id,
      rated_by: user.id,
      stars: r.stars,
      note: r.note || null,
      league_id,
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError } = await supabase
      .from('startlist_manager_ratings')
      .upsert(ratingsToInsert, {
        onConflict: 'startlist_id,manager_id,rated_by,league_id'
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: `Failed to save ratings: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update league-scoped note in league_startlist_notes table
    // Notes are now linked to race_id (persistent across startlist reimports)
    if (global_note !== undefined && league_id) {
      const cleaned = typeof global_note === 'string' ? global_note.trim() : null;
      
      // Upsert into league_startlist_notes using race_id
      const { error: upsertNoteError } = await supabase
        .from('league_startlist_notes')
        .upsert({
          league_id,
          race_id: raceId,
          startlist_id, // Keep for backwards compatibility
          admin_rating_note: cleaned || null,
          admin_rating_author_id: cleaned ? currentManager.id : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'league_id,race_id'
        });
      
      if (upsertNoteError) {
        console.error('Error updating league note:', upsertNoteError);
        return new Response(
          JSON.stringify({ error: `Failed to update league note: ${upsertNoteError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('League note updated', { 
        startlist_id,
        league_id, 
        length: cleaned ? cleaned.length : 0,
        author: currentManager.nom 
      });
    }

    // Fetch updated ratings aggregated for this league
    const { data: updatedRatings, error: fetchError } = await supabase
      .from('startlist_manager_ratings')
      .select('manager_id, stars')
      .eq('startlist_id', startlist_id)
      .eq('league_id', league_id);

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
      JSON.stringify({ 
        ratings: result,
        admin_rating_note: typeof global_note === 'string' ? global_note.trim() : null 
      }),
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
