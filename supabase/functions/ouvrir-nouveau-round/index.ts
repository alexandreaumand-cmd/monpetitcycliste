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
    // Create client with user's auth token to preserve auth.uid()
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
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

    const { phase_id, deadline_at, league_id, auto_launched } = await req.json();
    console.log('Opening new round for phase:', phase_id, 'league:', league_id);

    // Validation stricte du phase_id
    if (!phase_id) {
      console.error('❌ Missing phase_id in ouvrir-nouveau-round');
      return new Response(
        JSON.stringify({ 
          error: 'Le phase_id est obligatoire pour créer une enchère' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Check if user is league admin
    const { data: isLeagueAdmin, error: rpcError } = await supabase.rpc('is_league_admin', {
      l_id: league_id
    });

    console.log('League admin check result:', { isLeagueAdmin, rpcError, userId: user.id, leagueId: league_id });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw new Error('Erreur lors de la vérification des permissions');
    }

    if (!isLeagueAdmin) {
      // Fallback: direct check on league_members in case RPC fails or returns false unexpectedly
      const { data: membership, error: membershipError } = await supabase
        .from('league_members')
        .select('role_in_league')
        .eq('league_id', league_id)
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Direct role check result:', {
        role: membership?.role_in_league,
        membershipError,
        userId: user.id,
        leagueId: league_id,
      });

      if (membershipError) {
        console.error('Membership check error:', membershipError);
      }

      const role = membership?.role_in_league as string | undefined;
      if (!role || !['owner', 'admin'].includes(role)) {
        return new Response(
          JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs de la ligue' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fallback admin check passed via league_members for user:', user.id);
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