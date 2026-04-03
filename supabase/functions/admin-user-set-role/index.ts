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

    // Verify superadmin
    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) {
      throw new Error('Réservé aux super-administrateurs');
    }

    const { user_id, role } = await req.json();

    if (!user_id || !role) {
      throw new Error('user_id et role sont requis');
    }

    if (role === 'superadmin') {
      // Add or update superadmin role
      const { error } = await supabaseClient
        .from('user_roles')
        .upsert({ 
          user_id,
          role: 'superadmin'
        }, {
          onConflict: 'user_id,role'
        });

      if (error) throw error;
    } else {
      // Remove superadmin role
      const { error } = await supabaseClient
        .from('user_roles')
        .delete()
        .eq('user_id', user_id)
        .eq('role', 'superadmin');

      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Rôle mis à jour' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
