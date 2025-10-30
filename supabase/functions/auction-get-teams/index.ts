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

    console.log('[auction-get-teams] v4-team-options - Fetching teams for phase:', phase_id);

    // Use the new RPC function that returns team IDs and names
    const { data: teams, error } = await supabase
      .rpc('get_team_options_for_phase', { p_phase_id: phase_id });
    
    if (error) throw error;

    // Type the response
    type TeamOption = { equipe_id: string; nom_affiche: string };
    const rows: TeamOption[] = (teams as TeamOption[] | null) ?? [];
    
    // Map to { id, name } format
    const teamOptions = rows.map(t => ({
      id: t.equipe_id,
      name: t.nom_affiche
    }));

    console.log(`[auction-get-teams] v4-team-options - Found teams: ${teamOptions.length}`);

    return new Response(
      JSON.stringify({ teams: teamOptions }),
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
