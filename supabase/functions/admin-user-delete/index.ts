import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Regular client for verification
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

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id requis');
    }

    // Admin client for user deletion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check if user is trying to delete themselves
    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    if (currentUser?.id === user_id) {
      throw new Error('Vous ne pouvez pas supprimer votre propre compte');
    }

    // Get user info before deletion for logging
    const { data: userToDelete } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const userEmail = userToDelete?.user?.email || 'unknown';

    console.log(`Deleting user: ${userEmail} (${user_id})`);

    // Delete the user - this will cascade delete related data if ON DELETE CASCADE is set
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (error) throw error;

    console.log(`Successfully deleted user: ${userEmail} (${user_id})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Utilisateur ${userEmail} supprimé avec succès`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in admin-user-delete:', error);
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
