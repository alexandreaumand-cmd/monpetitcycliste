import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Utiliser SERVICE_ROLE_KEY pour bypasser RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Client pour vérifier l'authentification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Vérifier l'authentification
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier que l'utilisateur est superadmin
    const { data: isSuperAdmin } = await supabaseClient.rpc('is_superadmin');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: superadmin requis' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { league_id, league_name, confirmation_phrase } = await req.json();

    if (!league_id || !league_name) {
      return new Response(JSON.stringify({ error: 'league_id et league_name requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier que la ligue existe
    const { data: league } = await supabaseAdmin
      .from('leagues')
      .select('id, name')
      .eq('id', league_id)
      .single();

    if (!league) {
      return new Response(JSON.stringify({ error: 'Ligue introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier la phrase de confirmation
    const expectedPhrase = `DELETE LEAGUE ${league_name}`;
    if (confirmation_phrase !== expectedPhrase) {
      return new Response(JSON.stringify({ 
        error: `Phrase de confirmation incorrecte. Attendu: "${expectedPhrase}"` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🗑️ Starting league deletion for "${league_name}" (${league_id})`);

    const deleted: Record<string, number> = {};

    // Ordre de suppression respectant les contraintes FK
    // 1. Supprimer bonus_rider_selections
    const { count: bonusRiderCount } = await supabaseAdmin
      .from('bonus_rider_selections')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.bonus_rider_selections = bonusRiderCount || 0;
    console.log(`✅ Deleted ${deleted.bonus_rider_selections} bonus rider selections`);

    // 2. Supprimer manager_bonus_points
    const { count: managerBonusCount } = await supabaseAdmin
      .from('manager_bonus_points')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.manager_bonus_points = managerBonusCount || 0;
    console.log(`✅ Deleted ${deleted.manager_bonus_points} manager bonus points`);

    // 3. Supprimer bonus_points
    const { count: bonusPointsCount } = await supabaseAdmin
      .from('bonus_points')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.bonus_points = bonusPointsCount || 0;
    console.log(`✅ Deleted ${deleted.bonus_points} bonus points`);

    // 4. Supprimer manager_fun_awards (si elle a league_id)
    const { count: funAwardsCount } = await supabaseAdmin
      .from('manager_fun_awards')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.manager_fun_awards = funAwardsCount || 0;
    console.log(`✅ Deleted ${deleted.manager_fun_awards} fun awards`);

    // 5. Récupérer les auctions de la ligue pour supprimer annonces et bids
    const { data: auctions } = await supabaseAdmin
      .from('auctions')
      .select('id')
      .eq('league_id', league_id);
    const auctionIds = auctions?.map(a => a.id) || [];
    
    if (auctionIds.length > 0) {
      // 5a. Supprimer annonces
      const { count: annoncesCount } = await supabaseAdmin
        .from('annonces')
        .delete({ count: 'exact' })
        .in('auction_id', auctionIds);
      deleted.annonces = annoncesCount || 0;
      console.log(`✅ Deleted ${deleted.annonces} annonces`);

      // 5b. Supprimer bids
      const { count: bidsCount } = await supabaseAdmin
        .from('bids')
        .delete({ count: 'exact' })
        .eq('league_id', league_id);
      deleted.bids = bidsCount || 0;
      console.log(`✅ Deleted ${deleted.bids} bids`);
    }

    // 6. Supprimer auctions
    const { count: auctionsCount } = await supabaseAdmin
      .from('auctions')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.auctions = auctionsCount || 0;
    console.log(`✅ Deleted ${deleted.auctions} auctions`);

    // 7. Supprimer rosters
    const { count: rostersCount } = await supabaseAdmin
      .from('rosters')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.rosters = rostersCount || 0;
    console.log(`✅ Deleted ${deleted.rosters} rosters`);

    // 8. Supprimer transfers (si existe)
    try {
      const { count: transfersCount } = await supabaseAdmin
        .from('transfers')
        .delete({ count: 'exact' })
        .eq('league_id', league_id);
      deleted.transfers = transfersCount || 0;
      console.log(`✅ Deleted ${deleted.transfers} transfers`);
    } catch (e) {
      console.log('⚠️ Table transfers non trouvée (ignoré)');
    }

    // 9. Supprimer league_scopes
    const { count: scopesCount } = await supabaseAdmin
      .from('league_scopes')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.league_scopes = scopesCount || 0;
    console.log(`✅ Deleted ${deleted.league_scopes} league scopes`);

    // 10. Supprimer league_invites
    const { count: invitesCount } = await supabaseAdmin
      .from('league_invites')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.league_invites = invitesCount || 0;
    console.log(`✅ Deleted ${deleted.league_invites} league invites`);

    // 11. Supprimer league_invite_uses
    const { count: inviteUsesCount } = await supabaseAdmin
      .from('league_invite_uses')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.league_invite_uses = inviteUsesCount || 0;
    console.log(`✅ Deleted ${deleted.league_invite_uses} league invite uses`);

    // 12. Supprimer league_members
    const { count: membersCount } = await supabaseAdmin
      .from('league_members')
      .delete({ count: 'exact' })
      .eq('league_id', league_id);
    deleted.league_members = membersCount || 0;
    console.log(`✅ Deleted ${deleted.league_members} league members`);

    // 13. Supprimer la ligue elle-même
    const { count: leagueCount } = await supabaseAdmin
      .from('leagues')
      .delete({ count: 'exact' })
      .eq('id', league_id);
    deleted.leagues = leagueCount || 0;
    console.log(`✅ Deleted ${deleted.leagues} league`);

    // Récupérer le manager_id pour l'audit
    const { data: manager } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Logger l'action dans audits
    if (manager) {
      await supabaseAdmin
        .from('audits')
        .insert({
          actor_manager_id: manager.id,
          action: 'admin_delete_league',
          payload_json: JSON.stringify({
            league_id,
            league_name,
            deleted
          })
        });
    }

    console.log('✅ League deletion complete');

    return new Response(
      JSON.stringify({
        success: true,
        league_name,
        deleted
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
