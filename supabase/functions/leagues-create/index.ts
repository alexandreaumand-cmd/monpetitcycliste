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

    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get manager
    const { data: manager, error: managerError } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (managerError || !manager) {
      return new Response(JSON.stringify({ error: 'Manager introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      return new Response(
        JSON.stringify({ error: 'Template invalide' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

    if (phasesError || !phases || phases.length === 0) {
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
    
    if (auctionStrategy === 'single') {
      // One auction for the first phase only
      const { error: auctionError } = await supabase
        .from('auctions')
        .insert({
          phase_id: phases[0].id,
          league_id: league.id,
          round_number: 1,
          statut: 'scheduled',
          opens_at: firstAuctionStartsAt,
          deadline_at: deadlineAt.toISOString(),
        });

      if (auctionError) {
        console.error('Auction creation error:', auctionError);
      }
    } else if (auctionStrategy === 'per_phase') {
      // One auction per phase
      const auctionsToCreate = phases.map((phase, index) => ({
        phase_id: phase.id,
        league_id: league.id,
        round_number: 1,
        statut: 'scheduled' as const,
        opens_at: index === 0 ? firstAuctionStartsAt : null,
        deadline_at: index === 0 ? deadlineAt.toISOString() : null,
      }));

      const { error: auctionError } = await supabase
        .from('auctions')
        .insert(auctionsToCreate);

      if (auctionError) {
        console.error('Auctions creation error:', auctionError);
      }
    } else if (auctionStrategy === 'grouped') {
      // One auction per group of phases
      const groups = (template.auction_phase_groups as number[][]) || [];
      const auctionsToCreate = groups.map((group, groupIndex) => {
        // Find the first phase in this group
        const firstPhaseInGroup = phases.find(p => group.includes(p.index_dans_saison));
        if (!firstPhaseInGroup) return null;

        return {
          phase_id: firstPhaseInGroup.id,
          league_id: league.id,
          round_number: 1,
          statut: 'scheduled' as const,
          opens_at: groupIndex === 0 ? firstAuctionStartsAt : null,
          deadline_at: groupIndex === 0 ? deadlineAt.toISOString() : null,
        };
      }).filter(Boolean);

      if (auctionsToCreate.length > 0) {
        const { error: auctionError } = await supabase
          .from('auctions')
          .insert(auctionsToCreate as any[]);

        if (auctionError) {
          console.error('Grouped auctions creation error:', auctionError);
        }
      }
    }

    console.log('League created:', league.id, 'by user:', user.id);

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
