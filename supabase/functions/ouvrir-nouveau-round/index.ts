import { createClient } from 'npm:@supabase/supabase-js@2';
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
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}`;

    let supabase;

    const { phase_id, deadline_at, league_id, auto_launched, effective_phase_id } = await req.json();
    console.log('Opening new round for phase:', phase_id, 'effective_phase:', effective_phase_id, 'league:', league_id, 'auto_launched:', auto_launched);

    // Validation stricte du phase_id
    if (!phase_id) {
      console.error('❌ Missing phase_id in ouvrir-nouveau-round');
      return new Response(
        JSON.stringify({ error: 'Le phase_id est obligatoire pour créer une enchère' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (auto_launched && isServiceRoleCall) {
      // Auto mode: called from publier-annonce with service role
      console.log('🤖 Auto-launched: bypassing admin check (service role call)');
      supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        serviceRoleKey
      );
    } else {
      // Manual mode: require user auth and admin check
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Non authentifié' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: authHeader
            }
          }
        }
      );

      // Verify user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Non authentifié' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user is league admin
      const { data: isLeagueAdmin } = await supabase.rpc('is_league_admin', { l_id: league_id });

      if (!isLeagueAdmin) {
        const { data: membership } = await supabase
          .from('league_members')
          .select('role_in_league')
          .eq('league_id', league_id)
          .eq('user_id', user.id)
          .maybeSingle();

        const role = membership?.role_in_league as string | undefined;
        if (!role || !['owner', 'admin'].includes(role)) {
          return new Response(
            JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs de la ligue' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // STEP 1: Check if there's an existing scheduled auction to reuse
    const { data: scheduledAuction, error: scheduledError } = await supabase
      .from('auctions')
      .select('*')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .eq('statut', 'scheduled')
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (scheduledError) throw scheduledError;

    // If a scheduled round exists, start it early instead of creating a new one
    if (scheduledAuction) {
      console.log('Found scheduled auction to reuse:', scheduledAuction.id, 'round:', scheduledAuction.round_number);
      
      const { data: updatedAuction, error: updateError } = await supabase
        .from('auctions')
        .update({
          deadline_at,
          statut: 'open',
          ...(effective_phase_id && { effective_phase_id }),
        })
        .eq('id', scheduledAuction.id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      console.log('Started scheduled auction early:', updatedAuction);
      
      // Notify league members
      await notifyLeagueMembers(supabase, league_id, {
        type: 'auction_opened',
        title: auto_launched 
          ? `🤖 Round ${scheduledAuction.round_number} lancé automatiquement` 
          : `🎯 Round ${scheduledAuction.round_number} lancé !`,
        message: auto_launched
          ? `Le round ${scheduledAuction.round_number} a été lancé automatiquement. Deadline : ${new Date(deadline_at).toLocaleString('fr-FR')}. Placez vos enchères !`
          : `Le round ${scheduledAuction.round_number} est maintenant ouvert. Placez vos enchères avant la deadline !`,
        metadata: {
          auction_id: updatedAuction.id,
          round_number: scheduledAuction.round_number,
          phase_id: phase_id,
          league_id: league_id,
          league_name: (await supabase.from('leagues').select('name').eq('id', league_id).single()).data?.name || '',
          deadline_at: deadline_at,
          auto_launched: auto_launched || false
        }
      });

      return new Response(
        JSON.stringify({ success: true, auction: updatedAuction }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: No scheduled auction exists, create a new one
    console.log('No scheduled auction found, creating new round');

    // Get last auction for this phase and league
    const { data: lastAuction, error: auctionError } = await supabase
      .from('auctions')
      .select('round_number')
      .eq('phase_id', phase_id)
      .eq('league_id', league_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auctionError) throw auctionError;

    const newRoundNumber = lastAuction ? lastAuction.round_number + 1 : 1;
    console.log('Creating new round number:', newRoundNumber);

    // Create new auction
    const { data: newAuction, error: insertError } = await supabase
      .from('auctions')
      .insert({
        phase_id,
        effective_phase_id: effective_phase_id || phase_id,
        league_id,
        round_number: newRoundNumber,
        deadline_at,
        statut: 'open',
      })
      .select()
      .single();

    if (insertError) throw insertError;
    console.log('New round created:', newAuction);

    // Notify all league members
    await notifyLeagueMembers(supabase, league_id, {
      type: 'auction_opened',
      title: auto_launched 
        ? `🤖 Round ${newRoundNumber} lancé automatiquement` 
        : `🎯 Nouveau round d'enchères ouvert !`,
      message: auto_launched
        ? `Le round ${newRoundNumber} a été lancé automatiquement après publication des annonces. Deadline : ${new Date(deadline_at).toLocaleString('fr-FR')}. Placez vos enchères !`
        : `Le round ${newRoundNumber} est maintenant ouvert. Placez vos enchères avant la deadline !`,
      metadata: {
        auction_id: newAuction.id,
        round_number: newRoundNumber,
        phase_id: phase_id,
        league_id: league_id,
        league_name: (await supabase.from('leagues').select('name').eq('id', league_id).single()).data?.name || '',
        deadline_at: deadline_at,
        auto_launched: auto_launched || false
      }
    });

    return new Response(
      JSON.stringify({ success: true, auction: newAuction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error opening new round:', error);
    
    // Check for unique constraint violation (duplicate round number)
    const code = (error as any)?.code;
    const msg = (error as any)?.message || (error instanceof Error ? error.message : 'Unknown error');
    
    if (code === '23505') {
      return new Response(
        JSON.stringify({ 
          error: 'Un round avec ce numéro existe déjà pour cette phase dans cette ligue',
          code 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});