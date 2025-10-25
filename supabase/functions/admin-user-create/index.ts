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

    const { email, manager_name, role, send_invitation } = await req.json();

    if (!email || !manager_name) {
      throw new Error('Email et nom du manager requis');
    }

    // Admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Create user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: !send_invitation, // Auto-confirm if not sending invitation
      password: send_invitation ? undefined : Math.random().toString(36).slice(-12), // Random password if not inviting
    });

    if (userError) throw userError;

    // Create manager profile
    const { error: managerError } = await supabaseClient
      .from('managers')
      .insert({
        user_id: userData.user.id,
        nom: manager_name,
      });

    if (managerError) {
      // Rollback: delete user if manager creation fails
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      throw new Error('Erreur lors de la création du profil manager: ' + managerError.message);
    }

    // Set role if superadmin
    if (role === 'superadmin') {
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: userData.user.id,
          role: 'admin',
        });

      if (roleError) {
        console.error('Error setting role:', roleError);
      }
    }

    // Generate invitation link if requested
    let invitationLink = null;
    if (send_invitation) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: email,
      });

      if (!linkError && linkData) {
        invitationLink = linkData.properties.action_link;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Utilisateur créé avec succès',
        user_id: userData.user.id,
        invitation_link: invitationLink
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in admin-user-create:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
