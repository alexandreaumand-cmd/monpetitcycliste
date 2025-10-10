import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Verify admin access
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin');
    if (roleError || !isAdmin) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user's manager ID
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

    const url = new URL(req.url);
    const method = req.method;

    // GET - List all bonuses for a phase
    if (method === 'GET') {
      const phaseId = url.searchParams.get('phase_id');
      
      if (!phaseId) {
        return new Response(
          JSON.stringify({ error: 'phase_id requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('bonus_points')
        .select(`
          *,
          coureur:coureurs(nom, equipe),
          manager:managers(nom),
          target_manager:managers(nom)
        `)
        .eq('phase_id', phaseId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bonuses:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ bonuses: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Add a new bonus
    if (method === 'POST') {
      const body = await req.json();
      const { phase_id, bonus_type, coureur_id, manager_id, target_manager_id, points, commentaire } = body;

      if (!phase_id || !bonus_type || !points) {
        return new Response(
          JSON.stringify({ error: 'Paramètres manquants (phase_id, bonus_type, points requis)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate bonus type
      const validTypes = ['first_win', 'coureur_bonuse', 'itt', 'ttt', 'scoreurs'];
      if (!validTypes.includes(bonus_type)) {
        return new Response(
          JSON.stringify({ error: 'Type de bonus invalide' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check constraints based on bonus type
      const riderBonusTypes = ['first_win', 'coureur_bonuse', 'itt'];
      if (riderBonusTypes.includes(bonus_type)) {
        if (!coureur_id || !manager_id) {
          return new Response(
            JSON.stringify({ error: 'coureur_id et manager_id requis pour les bonus coureur' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        if (!target_manager_id) {
          return new Response(
            JSON.stringify({ error: 'target_manager_id requis pour les bonus manager' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { data, error } = await supabase
        .from('bonus_points')
        .insert({
          phase_id,
          bonus_type,
          coureur_id: riderBonusTypes.includes(bonus_type) ? coureur_id : null,
          manager_id: riderBonusTypes.includes(bonus_type) ? manager_id : null,
          target_manager_id: !riderBonusTypes.includes(bonus_type) ? target_manager_id : null,
          points,
          commentaire: commentaire || null,
          created_by: manager.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting bonus:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Audit log
      await supabase.from('audits').insert({
        actor_manager_id: manager.id,
        action: 'admin_add_bonus_point',
        payload_json: JSON.stringify({
          bonus_id: data.id,
          phase_id,
          bonus_type,
          points,
        })
      });

      console.log(`Bonus created: ${bonus_type} for phase ${phase_id}`);

      return new Response(
        JSON.stringify({ success: true, bonus: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remove a bonus
    if (method === 'DELETE') {
      const body = await req.json();
      const { id: bonusId } = body;

      if (!bonusId) {
        return new Response(
          JSON.stringify({ error: 'id requis dans le body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('bonus_points')
        .delete()
        .eq('id', bonusId);

      if (error) {
        console.error('Error deleting bonus:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Audit log
      await supabase.from('audits').insert({
        actor_manager_id: manager.id,
        action: 'admin_delete_bonus_point',
        payload_json: JSON.stringify({ bonus_id: bonusId })
      });

      console.log(`Bonus deleted: ${bonusId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Méthode non supportée' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-manage-bonus:', error);
    const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
