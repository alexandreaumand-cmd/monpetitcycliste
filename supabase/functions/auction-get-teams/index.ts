import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[auction-get-teams] v3-RPC - Starting');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phase_id } = await req.json();

    if (!phase_id) {
      return new Response(JSON.stringify({ error: 'phase_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[auction-get-teams] v3-RPC - Fetching teams for phase:', phase_id);

    // Use the RPC function for reliable distinct team retrieval
    const { data: teams, error } = await supabase
      .rpc('get_unique_teams_for_phase', { p_phase_id: phase_id });
    
    if (error) throw error;

    // Normalize the response to string[] with explicit typing
    type TeamRow = { team_name: string | null };
    const rows: TeamRow[] = (teams as TeamRow[] | null) ?? [];
    const teamNames: string[] = rows
      .map((t) => t.team_name)
      .filter((name): name is string => Boolean(name));

    // Sort alphabetically for consistency
    teamNames.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

    console.log(`[auction-get-teams] v3-RPC - Found teams: ${teamNames.length}`);


    return new Response(
      JSON.stringify({ teams: teamNames }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auction-get-teams:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
