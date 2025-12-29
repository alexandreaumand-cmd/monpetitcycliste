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
    // Client pour authentification (avec JWT utilisateur)
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Client admin pour les opérations DB (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user with JWT client
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Get manager using admin client
    const { data: manager, error: managerError } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (managerError || !manager) {
      console.error('Manager error:', managerError);
      return new Response(JSON.stringify({ error: 'Manager introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Manager found:', manager.id);

    const { 
      name, 
      visibility = 'private',
      gameMode,
      maxPlayers,
      bonusesEnabled,
      budget,
      maxRiders,
      scopeConfig,
      firstAuctionStartsAt,
    } = await req.json();

    // Validate inputs
    if (!name || !gameMode || !maxPlayers || !firstAuctionStartsAt) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate first auction date
    const firstAuctionDate = new Date(firstAuctionStartsAt);
    if (firstAuctionDate <= new Date()) {
      return new Response(
        JSON.stringify({ error: 'La date de la première enchère doit être dans le futur' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('league_templates')
      .select('*')
      .eq('id', gameMode)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('Template error:', templateError);
      return new Response(
        JSON.stringify({ error: 'Template invalide' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Creating league with template:', {
      templateId: template.id,
      templateName: template.name,
      auctionStrategy: template.auction_strategy,
      byPhase: template.by_phase,
      phaseIndexes: template.phase_indexes
    });

    // Get active season
    const { data: season, error: seasonError } = await supabase
      .from('saisons')
      .select('id')
      .order('annee', { ascending: false })
      .limit(1)
      .single();

    if (seasonError || !season) {
      return new Response(
        JSON.stringify({ error: 'Aucune saison active trouvée' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get phases based on phase_indexes from template
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('id, index_dans_saison, budget, max_coureurs')
      .eq('saison_id', season.id)
      .in('index_dans_saison', template.phase_indexes);

    if (phasesError) {
      console.error('Phases fetch error:', phasesError);
      return new Response(
        JSON.stringify({ error: phasesError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!phases || phases.length === 0) {
      console.error('No phases found for season:', season.id, 'with phase_indexes:', template.phase_indexes);
      return new Response(
        JSON.stringify({ error: 'Phases introuvables pour ce template' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sort phases by index
    phases.sort((a, b) => a.index_dans_saison - b.index_dans_saison);
    const phaseUuids = phases.map(p => p.id);

    console.log('Found phases for league:', {
      count: phases.length,
      phaseIds: phaseUuids,
      indexes: phases.map(p => p.index_dans_saison)
    });

    // Create league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name,
        visibility,
        owner_manager_id: manager.id,
        game_mode: gameMode,
        max_players: maxPlayers,
        current_player_count: 1,
        bonuses_enabled: bonusesEnabled ?? true,
        status: 'pending',
        first_auction_starts_at: firstAuctionStartsAt,
        settings: {
          budget: budget || template.base_budget,
          max_riders: maxRiders || template.base_max_riders,
        },
      })
      .select()
      .single();

    if (leagueError) {
      console.error('League creation error:', leagueError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la ligue' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate phases for by_phase leagues BEFORE creating scope
    if (template.by_phase && phaseUuids.length === 0) {
      console.error('Critical error: by_phase is true but no phases found for league:', league.id);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(
        JSON.stringify({ error: 'Impossible de créer une ligue par phase sans phases disponibles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create league scope with new fields
    const { error: scopeError } = await supabase
      .from('league_scopes')
      .insert({
        league_id: league.id,
        season_id: season.id,
        by_phase: template.by_phase,
        gt_only: template.gt_only,
        wt_only: template.wt_only,
        phases: phaseUuids,
        competitions: template.competitions || [],
        course_filters: template.course_filters || {},
      });

    if (scopeError) {
      console.error('Scope creation error:', scopeError);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création du scope' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('League scope created successfully for league:', league.id);

    // Add owner as member
    const { error: memberError } = await supabase
      .from('league_members')
      .insert({
        league_id: league.id,
        user_id: user.id,
        role_in_league: 'owner',
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
      await supabase.from('league_scopes').delete().eq('league_id', league.id);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'ajout du membre' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create auctions based on strategy
    const auctionStrategy = template.auction_strategy as string;
    const deadlineAt = new Date(firstAuctionDate.getTime() + 24 * 60 * 60 * 1000);
    
    console.log('Creating auctions with strategy:', auctionStrategy);
    
    if (auctionStrategy === 'single') {
      // One auction for the first phase only
      const auctionData = {
        phase_id: phases[0].id,
        league_id: league.id,
        round_number: 1,
        statut: 'scheduled' as const,
        opens_at: firstAuctionStartsAt,
        deadline_at: deadlineAt.toISOString(),
      };

      // Vérification de sécurité avant INSERT
      if (!auctionData.phase_id) {
        throw new Error('Cannot create auction without phase_id');
      }

      const { error: auctionError } = await supabase
        .from('auctions')
        .insert(auctionData);

      if (auctionError) {
        console.error('Single auction creation error:', auctionError);
        // Rollback all created data
        await supabase.from('league_members').delete().eq('league_id', league.id);
        await supabase.from('league_scopes').delete().eq('league_id', league.id);
        await supabase.from('leagues').delete().eq('id', league.id);
        return new Response(JSON.stringify({ error: 'Erreur lors de la création de l\'enchère: ' + auctionError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log('Single auction created successfully for league:', league.id);
    } else if (auctionStrategy === 'per_phase') {
      // One auction per phase
      console.log('Creating per_phase auctions for', phases.length, 'phases');
      
      const auctionsToCreate = phases.map((phase, index) => ({
        phase_id: phase.id,
        league_id: league.id,
        round_number: 1,
        statut: 'scheduled' as const,
        opens_at: index === 0 ? firstAuctionStartsAt : new Date(Date.now() + (index * 90 * 24 * 60 * 60 * 1000)).toISOString(),
        deadline_at: index === 0 
          ? deadlineAt.toISOString()
          : new Date(Date.now() + (index * 90 * 24 * 60 * 60 * 1000) + 24 * 60 * 60 * 1000).toISOString()
      }));

      // Vérification de sécurité : tous les phase_id doivent être définis
      if (auctionsToCreate.some(a => !a.phase_id)) {
        throw new Error('Cannot create auctions without phase_id');
      }

      const { error: auctionError } = await supabase
        .from('auctions')
        .insert(auctionsToCreate);

      if (auctionError) {
        console.error('Per-phase auctions creation error:', auctionError);
        // Rollback all created data
        await supabase.from('league_members').delete().eq('league_id', league.id);
        await supabase.from('league_scopes').delete().eq('league_id', league.id);
        await supabase.from('leagues').delete().eq('id', league.id);
        return new Response(JSON.stringify({ error: 'Erreur lors de la création des enchères: ' + auctionError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log('Per-phase auctions created successfully:', auctionsToCreate.length, 'auctions');
    } else if (auctionStrategy === 'grouped') {
      // One auction per group of phases
      const groups = (template.auction_phase_groups as number[][]) || [];
      console.log('Creating grouped auctions for', groups.length, 'groups');
      
      const auctionsToCreate = groups.map((group, groupIndex) => {
        // Find the first phase in this group
        const firstPhaseInGroup = phases.find(p => group.includes(p.index_dans_saison));
        if (!firstPhaseInGroup) return null;

        return {
          phase_id: firstPhaseInGroup.id,
          league_id: league.id,
          round_number: 1,
          statut: 'scheduled' as const,
          opens_at: groupIndex === 0 ? firstAuctionStartsAt : new Date(Date.now() + (groupIndex * 90 * 24 * 60 * 60 * 1000)).toISOString(),
          deadline_at: groupIndex === 0 
            ? deadlineAt.toISOString()
            : new Date(Date.now() + (groupIndex * 90 * 24 * 60 * 60 * 1000) + 24 * 60 * 60 * 1000).toISOString()
        };
      }).filter(Boolean);

      // Vérification de sécurité : tous les phase_id doivent être définis
      if (auctionsToCreate.some(a => !(a as any).phase_id)) {
        throw new Error('Cannot create grouped auctions without phase_id');
      }

      if (auctionsToCreate.length > 0) {
        const { error: auctionError } = await supabase
          .from('auctions')
          .insert(auctionsToCreate as any[]);

        if (auctionError) {
          console.error('Grouped auctions creation error:', auctionError);
          // Rollback all created data
          await supabase.from('league_members').delete().eq('league_id', league.id);
          await supabase.from('league_scopes').delete().eq('league_id', league.id);
          await supabase.from('leagues').delete().eq('id', league.id);
          return new Response(JSON.stringify({ error: 'Erreur lors de la création des enchères groupées: ' + auctionError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('Grouped auctions created successfully:', auctionsToCreate.length, 'auctions');
      }
    }

    // Final verification: ensure auctions were created
    const { count: auctionCount, error: countError } = await supabase
      .from('auctions')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.id);

    if (countError) {
      console.error('Error counting auctions:', countError);
    }

    console.log('Final auction count for league', league.id, ':', auctionCount);

    if (auctionCount === 0) {
      console.error('CRITICAL: No auctions created for league:', league.id);
      // Rollback all created data
      await supabase.from('league_members').delete().eq('league_id', league.id);
      await supabase.from('league_scopes').delete().eq('league_id', league.id);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(
        JSON.stringify({ error: 'Aucune enchère n\'a pu être créée pour cette ligue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('League created successfully:', league.id, 'with', auctionCount, 'auction(s)', 'by user:', user.id);

    return new Response(
      JSON.stringify({ league }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
