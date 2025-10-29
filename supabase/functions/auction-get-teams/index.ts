import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log('Fetching teams for phase:', phase_id);

    // Use optimized RPC function to get distinct teams
    const { data: teams, error } = await supabase
      .rpc('get_unique_teams_for_phase', { p_phase_id: phase_id });

    if (error) throw error;
    
    // Normalize to string array
    const teamNames = (teams || []).map((t: any) => typeof t === 'string' ? t : t.team_name).filter(Boolean);
    console.log('Found teams:', teamNames.length);

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
