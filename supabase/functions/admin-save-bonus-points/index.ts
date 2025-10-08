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

    const { phase_id, bonuses } = await req.json();

    if (!phase_id || !Array.isArray(bonuses)) {
      return new Response(
        JSON.stringify({ error: 'Paramètres invalides' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${bonuses.length} bonus entries for phase ${phase_id}`);

    let upserted = 0;
    let deleted = 0;

    // Process each bonus
    for (const bonus of bonuses) {
      const { manager_id, bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, commentaire } = bonus;

      const totalBonus = (bonus_itt || 0) + (bonus_ttt || 0) + (bonus_first_win || 0) + (bonus_coureurs || 0);

      if (totalBonus === 0 && !commentaire) {
        // Delete bonus if all bonuses are 0 and no comment
        const { error: deleteError } = await supabase
          .from('manager_bonus_points')
          .delete()
          .eq('phase_id', phase_id)
          .eq('manager_id', manager_id);

        if (deleteError) {
          console.error('Error deleting bonus:', deleteError);
        } else {
          deleted++;
        }
      } else {
        // Upsert bonus
        const { error: upsertError } = await supabase
          .from('manager_bonus_points')
          .upsert({
            phase_id,
            manager_id,
            bonus_itt: bonus_itt || 0,
            bonus_ttt: bonus_ttt || 0,
            bonus_first_win: bonus_first_win || 0,
            bonus_coureurs: bonus_coureurs || 0,
            commentaire,
            created_by: manager.id,
          }, {
            onConflict: 'phase_id,manager_id'
          });

        if (upsertError) {
          console.error('Error upserting bonus:', upsertError);
        } else {
          upserted++;
        }
      }
    }

    // Audit log
    await supabase.from('audits').insert({
      actor_manager_id: manager.id,
      action: 'admin_save_bonus_points',
      payload_json: JSON.stringify({
        phase_id,
        bonuses_count: bonuses.length,
        upserted,
        deleted
      })
    });

    console.log(`Bonus points saved: ${upserted} upserted, ${deleted} deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        upserted,
        deleted
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-save-bonus-points:', error);
    const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
