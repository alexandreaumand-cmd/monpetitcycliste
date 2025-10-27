import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check admin access
    const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || !isAdminData) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { startlist_id, decisions, save_alias = true } = await req.json();

    if (!startlist_id || !decisions || !Array.isArray(decisions)) {
      return new Response(
        JSON.stringify({ error: 'startlist_id et decisions (array) sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get manager ID
    const { data: { user } } = await supabase.auth.getUser();
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    let matchedNow = 0;

    // Process each decision
    for (const decision of decisions) {
      const { entry_id, coureur_id } = decision;

      if (!entry_id || !coureur_id) {
        continue;
      }

      // Get entry details
      const { data: entry } = await supabase
        .from('startlist_entries')
        .select('source_name, source_team')
        .eq('id', entry_id)
        .single();

      if (!entry) {
        continue;
      }

      // Update entry
      const { error: updateError } = await supabase
        .from('startlist_entries')
        .update({
          coureur_id,
          status: 'confirmed',
          confidence: 1.0,
        })
        .eq('id', entry_id);

      if (updateError) {
        console.error('Error updating entry:', updateError);
        continue;
      }

      matchedNow++;

      // Create alias if requested
      if (save_alias) {
        // Check if alias already exists
        const { data: existingAlias } = await supabase
          .from('name_aliases')
          .select('id')
          .eq('alias_text', entry.source_name)
          .eq('coureur_id', coureur_id)
          .maybeSingle();

        if (!existingAlias) {
          await supabase
            .from('name_aliases')
            .insert({
              alias_text: entry.source_name,
              coureur_id,
              source_team: entry.source_team,
              created_by_manager_id: manager?.id,
            });
        }
      }
    }

    // Count remaining unmatched
    const { count: remainingUnmatched } = await supabase
      .from('startlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('startlist_id', startlist_id)
      .eq('status', 'unmatched');

    return new Response(
      JSON.stringify({
        matched_now: matchedNow,
        remaining_unmatched: remainingUnmatched || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in startlist-confirm-matches:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
