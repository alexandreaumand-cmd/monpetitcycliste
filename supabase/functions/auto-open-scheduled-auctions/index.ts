import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyLeagueMembers } from '../_shared/notifications.ts';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const nowIso = new Date().toISOString();

    // Find all scheduled auctions where opens_at has passed.
    // Explicitly raise the limit to avoid the implicit 1000-row cap in case of growth.
    const { data: auctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, league_id, opens_at, deadline_at, round_number, phase_id')
      .eq('statut', 'scheduled')
      .lte('opens_at', nowIso)
      .order('opens_at', { ascending: true })
      .limit(2000);

    if (fetchError) {
      console.error('[auto-open] Error fetching scheduled auctions:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[auto-open] Found ${auctions?.length ?? 0} scheduled auction(s) past opens_at (now=${nowIso})`);

    if (!auctions || auctions.length === 0) {
      return new Response(JSON.stringify({ message: 'No auctions to open', opened: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique league IDs to check their status
    const leagueIds = [...new Set(auctions.map((a) => a.league_id))];
    console.log(`[auto-open] Distinct league ids: ${leagueIds.length} -> ${JSON.stringify(leagueIds)}`);

    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name, status, game_mode')
      .in('id', leagueIds);

    if (leaguesError) {
      console.error('[auto-open] Error fetching leagues:', leaguesError);
      return new Response(JSON.stringify({ error: leaguesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(
      `[auto-open] Leagues fetched: ${leagues?.length ?? 0} -> ${JSON.stringify(
        (leagues || []).map((l) => ({ id: l.id, name: l.name, status: l.status }))
      )}`
    );

    const activeLeagueIds = new Set(
      (leagues || []).filter((l) => l.status === 'active').map((l) => l.id)
    );

    const leagueNames = Object.fromEntries((leagues || []).map((l) => [l.id, l.name]));
    const leagueGameModes = Object.fromEntries((leagues || []).map((l) => [l.id, l.game_mode]));

    // Resolve phase indexes for the relevant phases
    const phaseIds = [...new Set(auctions.map((a) => a.phase_id).filter(Boolean))];
    const { data: phasesRows, error: phasesError } = phaseIds.length
      ? await supabase.from('phases').select('id, index_dans_saison').in('id', phaseIds)
      : { data: [] as Array<{ id: string; index_dans_saison: number | null }>, error: null };

    if (phasesError) {
      console.error('[auto-open] Error fetching phases (non-fatal):', phasesError);
    }

    const phaseIndexes = Object.fromEntries(
      (phasesRows || []).map((p) => [p.id, p.index_dans_saison])
    );

    // Only open auctions for active leagues
    const auctionsToOpen = auctions.filter((a) => activeLeagueIds.has(a.league_id));
    const skipped = auctions.length - auctionsToOpen.length;

    console.log(
      `[auto-open] Active leagues: ${activeLeagueIds.size}/${leagueIds.length}. To open: ${auctionsToOpen.length}, skipped (inactive league): ${skipped}`
    );

    if (auctionsToOpen.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No active leagues with pending auctions',
          opened: 0,
          found: auctions.length,
          skipped,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let opened = 0;
    const errors: Array<{ auction_id: string; error: string }> = [];

    for (const auction of auctionsToOpen) {
      try {
        // Recalculate deadline: 24h from now if the original deadline has also passed
        const originalDeadline = new Date(auction.deadline_at);
        const now = new Date();
        const newDeadline =
          originalDeadline > now
            ? auction.deadline_at
            : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

        const { error: updateError } = await supabase
          .from('auctions')
          .update({
            statut: 'open',
            deadline_at: newDeadline,
          })
          .eq('id', auction.id)
          .eq('statut', 'scheduled'); // Prevent race conditions

        if (updateError) {
          console.error(`[auto-open] Error opening auction ${auction.id}:`, updateError);
          errors.push({ auction_id: auction.id, error: updateError.message });
          continue;
        }

        opened++;
        console.log(
          `[auto-open] ✅ Opened auction ${auction.id} for league ${auction.league_id} (round ${auction.round_number})`
        );

        // Send notifications (non-fatal)
        try {
          await notifyLeagueMembers(supabase, auction.league_id, {
            type: 'auction_opened',
            title: '🔔 Enchères ouvertes !',
            message: `Le tour ${auction.round_number} des enchères est ouvert dans ${
              leagueNames[auction.league_id] || 'votre ligue'
            } !`,
            metadata: {
              league_id: auction.league_id,
              league_name: leagueNames[auction.league_id] || 'votre ligue',
              auction_id: auction.id,
              round_number: auction.round_number,
              phase_id: auction.phase_id ?? null,
              phase_index: auction.phase_id ? phaseIndexes[auction.phase_id] ?? null : null,
              game_mode: leagueGameModes[auction.league_id] ?? null,
            },
          });
        } catch (notifErr) {
          console.error('[auto-open] Notification error (non-fatal):', notifErr);
        }
      } catch (loopErr) {
        console.error(`[auto-open] Unexpected error processing auction ${auction.id}:`, loopErr);
        errors.push({
          auction_id: auction.id,
          error: loopErr instanceof Error ? loopErr.message : String(loopErr),
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Opened ${opened} auction(s)`,
        opened,
        found: auctions.length,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[auto-open] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
