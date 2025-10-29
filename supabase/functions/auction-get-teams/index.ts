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

    const pageSize = 1000;
    const uniqueTeams = new Set<string>();
    let offset = 0;
    let pageCount = 0;

    // Paginated fetch to avoid API limits
    while (true) {
      const { data, error } = await supabase
        .from('coureurs_disponibilite')
        .select('coureur_equipe')
        .eq('phase_id', phase_id)
        .not('coureur_equipe', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      pageCount++;
      const fetchedCount = data?.length || 0;
      
      // Add teams to set for deduplication
      data?.forEach(row => {
        if (row.coureur_equipe) {
          uniqueTeams.add(row.coureur_equipe);
        }
      });

      console.log(`Page ${pageCount} fetched: ${fetchedCount} rows, accumulated unique: ${uniqueTeams.size}`);

      // Stop if we got less than pageSize (last page)
      if (fetchedCount < pageSize) {
        break;
      }

      offset += pageSize;
    }

    // Sort alphabetically
    const teamNames = Array.from(uniqueTeams).sort((a, b) => 
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );

    console.log(`Found teams: ${teamNames.length} (pages: ${pageCount})`);

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
