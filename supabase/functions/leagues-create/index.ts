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
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: manager } = await supabase
      .from('managers').select('id').eq('user_id', user.id).single();

    if (!manager) {
      return new Response(JSON.stringify({ error: 'Manager introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      name,
      visibility = 'private',
      gameMode,
      maxPlayers,
      bonusesEnabled,
      firstAuctionStartsAt,
      // five_phases specific
      variant,        // 'full_season' | 'wt_only'
      
      // per_course specific
      selectedCourseIds, // string[]
    } = body;

    if (!name || !gameMode || !maxPlayers || !firstAuctionStartsAt) {
      return new Response(JSON.stringify({ error: 'Paramètres manquants' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstAuctionDate = new Date(firstAuctionStartsAt);
    if (firstAuctionDate <= new Date()) {
      return new Response(JSON.stringify({ error: 'La date doit être dans le futur' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get active season
    const { data: season } = await supabase
      .from('saisons').select('id').order('annee', { ascending: false }).limit(1).single();

    if (!season) {
      return new Response(JSON.stringify({ error: 'Aucune saison active' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let budget: number;
    let maxRiders: number;
    let byPhase: boolean;
    let wtOnly: boolean;
    let gtOnly: boolean;
    let phaseUuids: string[] = [];
    let scopeSelectedCourseIds: string[] | null = null;
    let leagueStartingPhaseIndex: number | null = null;

    if (gameMode === 'five_phases') {
      budget = 2200;
      maxRiders = 30;
      byPhase = true;
      wtOnly = variant === 'wt_only';
      gtOnly = false;
      leagueStartingPhaseIndex = null;

      // Get phases from starting index
      const { data: phases } = await supabase
        .from('phases')
        .select('id, index_dans_saison')
        .eq('saison_id', season.id)
        .gte('index_dans_saison', leagueStartingPhaseIndex)
        .order('index_dans_saison');

      if (!phases?.length) {
        return new Response(JSON.stringify({ error: 'Aucune phase disponible' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      phaseUuids = phases.map(p => p.id);

    } else if (gameMode === 'per_course') {
      if (!selectedCourseIds?.length) {
        return new Response(JSON.stringify({ error: 'Sélectionnez au moins une course' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get selected courses to determine type
      const { data: courses } = await supabase
        .from('courses')
        .select('id, type_course, phase_id')
        .in('id', selectedCourseIds);

      if (!courses?.length) {
        return new Response(JSON.stringify({ error: 'Courses introuvables' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hasStageRace = courses.some(c => c.type_course === 'stage_race');
      if (hasStageRace) {
        budget = 1100; maxRiders = 15;
      } else if (courses.length === 1) {
        budget = 650; maxRiders = 8;
      } else {
        budget = 800; maxRiders = 10;
      }

      byPhase = false;
      wtOnly = false;
      gtOnly = false;
      scopeSelectedCourseIds = selectedCourseIds;

      // Get unique phase for the first course (needed for auction)
      const uniquePhaseIds = [...new Set(courses.map(c => c.phase_id).filter(Boolean))];
      phaseUuids = uniquePhaseIds as string[];

    } else {
      return new Response(JSON.stringify({ error: 'Mode de jeu invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name,
        visibility,
        owner_manager_id: manager.id,
        game_mode: gameMode,
        max_players: maxPlayers,
        current_player_count: 0,
        bonuses_enabled: bonusesEnabled ?? true,
        status: 'pending',
        first_auction_starts_at: firstAuctionStartsAt,
        starting_phase_index: leagueStartingPhaseIndex,
        settings: { budget, max_riders: maxRiders },
      })
      .select()
      .single();

    if (leagueError) {
      console.error('League creation error:', leagueError);
      return new Response(JSON.stringify({ error: 'Erreur création ligue' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create scope
    const { error: scopeError } = await supabase
      .from('league_scopes')
      .insert({
        league_id: league.id,
        season_id: season.id,
        by_phase: byPhase,
        gt_only: gtOnly,
        wt_only: wtOnly,
        phases: phaseUuids,
        competitions: [],
        course_filters: {},
        selected_course_ids: scopeSelectedCourseIds,
      });

    if (scopeError) {
      console.error('Scope error:', scopeError);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(JSON.stringify({ error: 'Erreur création scope' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add owner as member
    const { error: memberError } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: user.id, role_in_league: 'owner' });

    if (memberError) {
      await supabase.from('league_scopes').delete().eq('league_id', league.id);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(JSON.stringify({ error: 'Erreur ajout membre' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create auction(s)
    const deadlineAt = new Date(firstAuctionDate.getTime() + 24 * 60 * 60 * 1000);
    const firstPhaseId = phaseUuids[0];

    if (!firstPhaseId) {
      await supabase.from('league_members').delete().eq('league_id', league.id);
      await supabase.from('league_scopes').delete().eq('league_id', league.id);
      await supabase.from('leagues').delete().eq('id', league.id);
      return new Response(JSON.stringify({ error: 'Phase introuvable pour enchère' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (gameMode === 'per_course') {
      // Single auction
      const { error: auctionError } = await supabase.from('auctions').insert({
        phase_id: firstPhaseId,
        league_id: league.id,
        round_number: 1,
        statut: 'scheduled',
        opens_at: firstAuctionStartsAt,
        deadline_at: deadlineAt.toISOString(),
      });

      if (auctionError) {
        console.error('Auction error:', auctionError);
        await supabase.from('league_members').delete().eq('league_id', league.id);
        await supabase.from('league_scopes').delete().eq('league_id', league.id);
        await supabase.from('leagues').delete().eq('id', league.id);
        return new Response(JSON.stringify({ error: 'Erreur création enchère' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // per_phase: create auction for first phase only, others will be scheduled by super-admin via phase_auction_schedule
      const { error: auctionError } = await supabase.from('auctions').insert({
        phase_id: firstPhaseId,
        league_id: league.id,
        round_number: 1,
        statut: 'scheduled',
        opens_at: firstAuctionStartsAt,
        deadline_at: deadlineAt.toISOString(),
      });

      if (auctionError) {
        console.error('Auction error:', auctionError);
        await supabase.from('league_members').delete().eq('league_id', league.id);
        await supabase.from('league_scopes').delete().eq('league_id', league.id);
        await supabase.from('leagues').delete().eq('id', league.id);
        return new Response(JSON.stringify({ error: 'Erreur création enchère' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('League created:', league.id, 'mode:', gameMode);

    return new Response(JSON.stringify({ league }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
