import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Check if user is owner or admin
    const { data: member, error: memberError } = await supabaseClient
      .from('league_members')
      .select('role_in_league')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      throw new Error('Not a member of this league');
    }

    if (!['owner', 'admin'].includes(member.role_in_league)) {
      throw new Error('Only owners and admins can archive leagues');
    }

    // Archive league
    const { error: updateError } = await supabaseClient
      .from('leagues')
      .update({
        status: 'completed',
        archived_at: new Date().toISOString(),
      })
      .eq('id', leagueId);

    if (updateError) {
      console.error('Error archiving league:', updateError);
      throw updateError;
    }

    console.log(`League archived: ${leagueId}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in leagues-archive:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
