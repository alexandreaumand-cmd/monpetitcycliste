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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check if user is admin
    const { data: roles } = await supabase.rpc('get_my_roles');
    const isAdmin = roles?.includes('admin');
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès réservé aux administrateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { decisions } = await req.json();

    if (!Array.isArray(decisions) || decisions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'decisions requis (array)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current manager
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      return new Response(
        JSON.stringify({ error: 'Manager non trouvé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert aliases
    const aliases = decisions.map((d: any) => ({
      alias_text: d.source_name,
      coureur_id: d.coureur_id,
      source_team: d.team_code || null,
      created_by_manager_id: manager.id,
    }));

    const { error: insertError, count } = await supabase
      .from('name_aliases')
      .upsert(aliases, { 
        onConflict: 'alias_text,coureur_id',
        ignoreDuplicates: true 
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        aliases_saved: count || decisions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in startlist-save-aliases:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});