import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { leagueId } = await req.json();

    if (!leagueId) {
      throw new Error('League ID is required');
    }

    // Get manager
    const { data: manager, error: managerError } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (managerError || !manager) {
      throw new Error('Manager not found');
    }

    // Check if league exists, is pending, and user is owner
    const { data: league, error: leagueError } = await supabaseClient
      .from('leagues')
      .select('id, status, owner_manager_id')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      throw new Error('League not found');
    }

    if (league.owner_manager_id !== manager.id) {
      throw new Error('Only the owner can delete this league');
    }

    if (league.status !== 'pending') {
      throw new Error('Only pending leagues can be deleted');
    }

    // Delete league (cascade will handle members, scopes, invites)
    const { error: deleteError } = await supabaseClient
      .from('leagues')
      .delete()
      .eq('id', leagueId);

    if (deleteError) {
      console.error('Error deleting league:', deleteError);
      throw deleteError;
    }

    console.log(`League deleted: ${leagueId}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in leagues-delete:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
