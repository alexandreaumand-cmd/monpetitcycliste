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

    // Get distinct team names from coureurs_disponibilite
    const { data: teams, error } = await supabase
      .from('coureurs_disponibilite')
      .select('coureur_equipe')
      .eq('phase_id', phase_id)
      .not('coureur_equipe', 'is', null)
      .order('coureur_equipe', { ascending: true });

    if (error) throw error;

    // Extract unique team names
    const uniqueTeams = [...new Set(teams?.map(t => t.coureur_equipe) || [])];
    
    console.log('Found teams:', uniqueTeams.length);

    return new Response(
      JSON.stringify({ teams: uniqueTeams }),
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
