import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { startlist_id } = await req.json();

    console.log('Fetching entries for startlist:', startlist_id);

    // Get all entries with coureur details if matched
    const { data: entries, error: entriesError } = await supabase
      .from('startlist_entries')
      .select(`
        id,
        line_no,
        bib_no,
        status,
        source_name,
        source_team,
        coureur_id,
        coureurs(
          nom,
          equipe
        )
      `)
      .eq('startlist_id', startlist_id)
      .order('line_no', { ascending: true });

    if (entriesError) throw entriesError;

    // Calculate stats
    const total = entries?.length || 0;
    const matched = entries?.filter(e => e.coureur_id !== null).length || 0;
    const unmatched = total - matched;

    const result = {
      entries: entries || [],
      stats: {
        total,
        matched,
        unmatched
      }
    };

    console.log('Entries result:', { total, matched, unmatched });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in startlist-entries-list:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
