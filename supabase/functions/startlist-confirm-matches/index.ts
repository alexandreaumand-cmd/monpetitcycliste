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

    const body = await req.json();
    const { items, create_alias = true } = body;

    if (!items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: 'items (array) requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[startlist-confirm-matches] Confirming ${items.length} matches`);

    // Get manager ID
    const { data: { user } } = await supabase.auth.getUser();
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user?.id)
      .maybeSingle();

    let confirmedCount = 0;
    let aliasesCreated = 0;

    for (const item of items) {
      const { entry_id, coureur_id } = item;

      if (!entry_id || !coureur_id) {
        console.warn('[startlist-confirm-matches] Skipping item without entry_id or coureur_id');
        continue;
      }

      // Get entry details
      const { data: entry, error: entryError } = await supabase
        .from('startlist_entries')
        .select('source_name, source_team')
        .eq('id', entry_id)
        .single();

      if (entryError || !entry) {
        console.error(`[startlist-confirm-matches] Entry ${entry_id} not found:`, entryError);
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
        console.error(`[startlist-confirm-matches] Error updating entry ${entry_id}:`, updateError);
        continue;
      }

      confirmedCount++;

      // Create alias if requested
      if (create_alias) {
        // Check if alias already exists
        const { data: existingAlias } = await supabase
          .from('name_aliases')
          .select('id')
          .eq('alias_text', entry.source_name)
          .eq('coureur_id', coureur_id)
          .maybeSingle();

        if (!existingAlias) {
          const { error: aliasError } = await supabase
            .from('name_aliases')
            .insert({
              alias_text: entry.source_name,
              coureur_id,
              source_team: entry.source_team,
              created_by_manager_id: manager?.id,
            });

          if (!aliasError) {
            aliasesCreated++;
          } else {
            console.error(`[startlist-confirm-matches] Error creating alias:`, aliasError);
          }
        }
      }
    }

    console.log(`[startlist-confirm-matches] Confirmed ${confirmedCount} matches, created ${aliasesCreated} aliases`);

    return new Response(
      JSON.stringify({
        confirmed: confirmedCount,
        aliases_created: aliasesCreated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[startlist-confirm-matches] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
