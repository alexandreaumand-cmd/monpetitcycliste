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

    const { saison_id, confirmation_phrase, delete_season_itself } = await req.json();

    if (!saison_id) {
      return new Response(JSON.stringify({ error: 'saison_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer l'année de la saison pour validation
    const { data: saison } = await supabaseAdmin
      .from('saisons')
      .select('annee')
      .eq('id', saison_id)
      .single();

    if (!saison) {
      return new Response(JSON.stringify({ error: 'Saison introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier la phrase de confirmation
    const expectedPhrase = `DELETE SEASON ${saison.annee}`;
    if (confirmation_phrase !== expectedPhrase) {
      return new Response(JSON.stringify({ 
        error: `Phrase de confirmation incorrecte. Attendu: "${expectedPhrase}"` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🗑️ Starting season deletion for ${saison.annee} (${saison_id})`);

    const deleted: Record<string, number> = {};

    // Récupérer les IDs des phases
    const { data: phases } = await supabaseAdmin
      .from('phases')
      .select('id')
      .eq('saison_id', saison_id);
    const phaseIds = phases?.map(p => p.id) || [];
    console.log(`Found ${phaseIds.length} phases`);

    // Récupérer les IDs des courses
    let courseIds: string[] = [];
    if (phaseIds.length > 0) {
      const { data: courses } = await supabaseAdmin
        .from('courses')
        .select('id')
        .in('phase_id', phaseIds);
      courseIds = courses?.map(c => c.id) || [];
      console.log(`Found ${courseIds.length} courses`);
    }

    // Récupérer les IDs des startlists
    let startlistIds: string[] = [];
    if (courseIds.length > 0) {
      const { data: startlists } = await supabaseAdmin
        .from('startlist_imports')
        .select('id')
        .in('race_id', courseIds);
      startlistIds = startlists?.map(s => s.id) || [];
      console.log(`Found ${startlistIds.length} startlists`);
    }

    // Récupérer les IDs des auctions
    let auctionIds: string[] = [];
    if (phaseIds.length > 0) {
      const { data: auctions } = await supabaseAdmin
        .from('auctions')
        .select('id')
        .in('phase_id', phaseIds);
      auctionIds = auctions?.map(a => a.id) || [];
      console.log(`Found ${auctionIds.length} auctions`);
    }

    // 1. Supprimer startlist_manager_ratings
    if (startlistIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('startlist_manager_ratings')
        .delete({ count: 'exact' })
        .in('startlist_id', startlistIds);
      deleted.startlist_ratings = count || 0;
      console.log(`✅ Deleted ${deleted.startlist_ratings} startlist ratings`);
    }

    // 2. Supprimer startlist_entries
    if (startlistIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('startlist_entries')
        .delete({ count: 'exact' })
        .in('startlist_id', startlistIds);
      deleted.startlist_entries = count || 0;
      console.log(`✅ Deleted ${deleted.startlist_entries} startlist entries`);
    }

    // 3. Supprimer startlist_imports
    if (startlistIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('startlist_imports')
        .delete({ count: 'exact' })
        .in('id', startlistIds);
      deleted.startlist_imports = count || 0;
      console.log(`✅ Deleted ${deleted.startlist_imports} startlist imports`);
    }

    // 4. Supprimer points_ledger
    if (phaseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('points_ledger')
        .delete({ count: 'exact' })
        .in('phase_id', phaseIds);
      deleted.points_ledger = count || 0;
      console.log(`✅ Deleted ${deleted.points_ledger} points ledger entries`);
    }

    // 5. Supprimer race_results
    const { count: raceResultsCount } = await supabaseAdmin
      .from('race_results')
      .delete({ count: 'exact' })
      .eq('saison_id', saison_id);
    deleted.race_results = raceResultsCount || 0;
    console.log(`✅ Deleted ${deleted.race_results} race results`);

    // 6. Supprimer race_result_sets
    const { count: resultSetsCount } = await supabaseAdmin
      .from('race_result_sets')
      .delete({ count: 'exact' })
      .eq('saison_id', saison_id);
    deleted.race_result_sets = resultSetsCount || 0;
    console.log(`✅ Deleted ${deleted.race_result_sets} result sets`);

    // 7. Supprimer race_results_history
    if (courseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('race_results_history')
        .delete({ count: 'exact' })
        .in('course_id', courseIds);
      deleted.race_results_history = count || 0;
      console.log(`✅ Deleted ${deleted.race_results_history} results history`);
    }

    // 8. Supprimer annonces
    if (auctionIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('annonces')
        .delete({ count: 'exact' })
        .in('auction_id', auctionIds);
      deleted.annonces = count || 0;
      console.log(`✅ Deleted ${deleted.annonces} annonces`);
    }

    // 9. Supprimer bids
    if (auctionIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('bids')
        .delete({ count: 'exact' })
        .in('auction_id', auctionIds);
      deleted.bids = count || 0;
      console.log(`✅ Deleted ${deleted.bids} bids`);
    }

    // 10. Supprimer auctions
    if (auctionIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('auctions')
        .delete({ count: 'exact' })
        .in('id', auctionIds);
      deleted.auctions = count || 0;
      console.log(`✅ Deleted ${deleted.auctions} auctions`);
    }

    // 11. Supprimer bonus_points
    if (phaseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('bonus_points')
        .delete({ count: 'exact' })
        .in('phase_id', phaseIds);
      deleted.bonus_points = count || 0;
      console.log(`✅ Deleted ${deleted.bonus_points} bonus points`);
    }

    // 12. Supprimer manager_bonus_points
    if (phaseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('manager_bonus_points')
        .delete({ count: 'exact' })
        .in('phase_id', phaseIds);
      deleted.manager_bonus_points = count || 0;
      console.log(`✅ Deleted ${deleted.manager_bonus_points} manager bonus points`);
    }

    // 13. Supprimer bonus_rider_selections
    if (phaseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('bonus_rider_selections')
        .delete({ count: 'exact' })
        .in('phase_id', phaseIds);
      deleted.bonus_rider_selections = count || 0;
      console.log(`✅ Deleted ${deleted.bonus_rider_selections} bonus rider selections`);
    }

    // 14. Supprimer manager_fun_awards
    if (phaseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('manager_fun_awards')
        .delete({ count: 'exact' })
        .in('phase_id', phaseIds);
      deleted.manager_fun_awards = count || 0;
      console.log(`✅ Deleted ${deleted.manager_fun_awards} fun awards`);
    }

    // 15. Supprimer rosters
    if (phaseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('rosters')
        .delete({ count: 'exact' })
        .in('phase_id', phaseIds);
      deleted.rosters = count || 0;
      console.log(`✅ Deleted ${deleted.rosters} rosters`);
    }

    // 16. Supprimer manager_sponsors
    const { count: sponsorsCount } = await supabaseAdmin
      .from('manager_sponsors')
      .delete({ count: 'exact' })
      .eq('saison_id', saison_id);
    deleted.manager_sponsors = sponsorsCount || 0;
    console.log(`✅ Deleted ${deleted.manager_sponsors} manager sponsors`);

    // 17. Supprimer coureurs_saisons
    const { count: coureursCount } = await supabaseAdmin
      .from('coureurs_saisons')
      .delete({ count: 'exact' })
      .eq('saison_id', saison_id);
    deleted.coureurs_saisons = coureursCount || 0;
    console.log(`✅ Deleted ${deleted.coureurs_saisons} coureurs saisons`);

    // 18. Supprimer courses
    if (courseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('courses')
        .delete({ count: 'exact' })
        .in('id', courseIds);
      deleted.courses = count || 0;
      console.log(`✅ Deleted ${deleted.courses} courses`);
    }

    // 19. Supprimer scoring_rules_saisons
    const { count: scoringCount } = await supabaseAdmin
      .from('scoring_rules_saisons')
      .delete({ count: 'exact' })
      .eq('saison_id', saison_id);
    deleted.scoring_rules_saisons = scoringCount || 0;
    console.log(`✅ Deleted ${deleted.scoring_rules_saisons} scoring rules`);

    // 20. Supprimer phases
    if (phaseIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('phases')
        .delete({ count: 'exact' })
        .in('id', phaseIds);
      deleted.phases = count || 0;
      console.log(`✅ Deleted ${deleted.phases} phases`);
    }

    // 21. Supprimer la saison elle-même si demandé
    if (delete_season_itself === true) {
      const { count } = await supabaseAdmin
        .from('saisons')
        .delete({ count: 'exact' })
        .eq('id', saison_id);
      deleted.saisons = count || 0;
      console.log(`✅ Deleted ${deleted.saisons} saison`);
    }

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
          action: 'admin_delete_season',
          payload_json: JSON.stringify({
            saison_id,
            saison_annee: saison.annee,
            delete_season_itself,
            deleted
          })
        });
    }

    console.log('✅ Season deletion complete');

    return new Response(
      JSON.stringify({
        success: true,
        saison_annee: saison.annee,
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
