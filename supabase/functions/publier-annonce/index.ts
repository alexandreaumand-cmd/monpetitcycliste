import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { auction_id, publish_all, lang = 'fr', auto_mode } = await req.json();
    console.log('Publishing annonce for auction:', auction_id, 'publish_all:', publish_all, 'auto_mode:', auto_mode, 'lang:', lang);

    // Check if announcements are paused
    const { data: auctionCheck } = await supabase
      .from('auctions')
      .select('announcements_paused')
      .eq('id', auction_id)
      .single();

    if (auctionCheck?.announcements_paused) {
      return new Response(
        JSON.stringify({ error: 'Les annonces sont en pause. Un manager a demandé une pause.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use 10s intervals in auto mode, 1s in manual mode
    const intervalMs = auto_mode ? 10000 : 1000;

    // Translations for announcement text
    const translations = {
      fr: {
        wonBy: 'GAGNÉ par',
        at: 'à',
        losers: 'Managers battus',
        tie: 'ÉGALITÉ au montant max',
        between: 'entre',
        nextRound: 'Le coureur repart au PROCHAIN ROUND'
      },
      en: {
        wonBy: 'WON by',
        at: 'at',
        losers: 'Outbid managers',
        tie: 'TIE at max amount',
        between: 'between',
        nextRound: 'The rider goes to NEXT ROUND'
      }
    };
    const t = translations[lang as keyof typeof translations] || translations.fr;

    if (publish_all) {
      console.log('📢 Publishing all annonces in order (highest amount first)...');
      
      // Fetch all unpublished annonces sorted by winning_amount DESC
      const { data: unpublishedAnnonces, error: fetchError } = await supabase
        .from('annonces')
        .select('id, winning_amount')
        .eq('auction_id', auction_id)
        .eq('published', false)
        .order('winning_amount', { ascending: true }); // Cheapest first
      
      if (fetchError) throw fetchError;
      
      if (!unpublishedAnnonces || unpublishedAnnonces.length === 0) {
        return new Response(
          JSON.stringify({ success: true, count: 0, message: 'No annonces to publish' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Publish each annonce with incremental timestamp
      let baseTimestamp = new Date();
      let publishedCount = 0;
      
      for (let i = 0; i < unpublishedAnnonces.length; i++) {
        const annonce = unpublishedAnnonces[i];
        const publishedAt = new Date(baseTimestamp.getTime() + (i * intervalMs));
        
        const { error: updateError } = await supabase
          .from('annonces')
          .update({ 
            published: true, 
            published_at: publishedAt.toISOString() 
          })
          .eq('id', annonce.id);
        
        if (updateError) {
          console.error(`Error publishing annonce ${annonce.id}:`, updateError);
        } else {
          publishedCount++;
          console.log(`✅ Published annonce ${annonce.id} (${annonce.winning_amount}) at ${publishedAt.toISOString()}`);
        }
      }
      
      console.log(`📢 Published ${publishedCount}/${unpublishedAnnonces.length} annonces`);
      
      // Auto-launch next round logic
      const { count: unpublishedCount, error: countError } = await supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auction_id)
        .eq('published', false);
      
      if (countError) {
        console.error('Error checking unpublished annonces:', countError);
      }
      
      if (unpublishedCount === 0) {
        console.log('🎯 All annonces published, checking if next round is needed...');
        
        const { data: currentAuction, error: auctionError } = await supabase
          .from('auctions')
          .select('phase_id, effective_phase_id, round_number, league_id')
          .eq('id', auction_id)
          .single();
        
        if (auctionError || !currentAuction) {
          console.error('Error fetching auction:', auctionError);
        } else {
          const effectivePhase = currentAuction.effective_phase_id ?? currentAuction.phase_id;
          
          const { data: rosterStatuses } = await supabase
            .from('managers_rosters_status')
            .select('manager_id, slots_restants')
            .eq('phase_id', effectivePhase)
            .eq('league_id', currentAuction.league_id);

          const allComplete = rosterStatuses && rosterStatuses.length > 0 && rosterStatuses.every(m => (m.slots_restants ?? 0) === 0);

          if (allComplete) {
            console.log('✅ All rosters complete — no next round needed. Auction phase finished.');
          } else {
            const deadlineAt = new Date();
            deadlineAt.setHours(deadlineAt.getHours() + 24);
            
            const { error: openError } = await supabase.functions.invoke('ouvrir-nouveau-round', {
              body: {
                phase_id: currentAuction.phase_id,
                deadline_at: deadlineAt.toISOString(),
                league_id: currentAuction.league_id,
                auto_launched: true
              }
            });
            
            if (openError) {
              console.error('❌ Error auto-launching next round:', openError);
            } else {
              console.log('✅ Next round auto-launched successfully');
            }
          }
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, count: publishedCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Publish next annonce (lowest price first)
      const { data: annonce, error } = await supabase
        .from('annonces')
        .select('*, coureurs(*), managers(*)')
        .eq('auction_id', auction_id)
        .eq('published', false)
        .order('winning_amount', { ascending: true })
        .limit(1)
        .single();

      if (error || !annonce) {
        return new Response(
          JSON.stringify({ success: false, message: 'Aucune annonce à publier' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as published
      await supabase
        .from('annonces')
        .update({ published: true, published_at: new Date().toISOString() })
        .eq('id', annonce.id);

      // Check if all annonces are now published
      const { count: unpublishedCount, error: countError } = await supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auction_id)
        .eq('published', false);

      if (countError) {
        console.error('Error checking unpublished annonces:', countError);
      }

      // Auto-launch next round if all annonces are published
      if (unpublishedCount === 0) {
        console.log('🎯 All annonces published, checking if next round is needed...');
        
        const { data: currentAuction, error: auctionError } = await supabase
          .from('auctions')
          .select('phase_id, effective_phase_id, round_number, league_id')
          .eq('id', auction_id)
          .single();
        
        if (auctionError || !currentAuction) {
          console.error('Error fetching auction:', auctionError);
        } else {
          // Check if all rosters are complete before opening next round
          const { data: rosterStatuses } = await supabase
            .from('managers_rosters_status')
            .select('manager_id, slots_restants')
            .eq('phase_id', currentAuction.phase_id)
            .eq('league_id', currentAuction.league_id);

          const allComplete = rosterStatuses && rosterStatuses.length > 0 && rosterStatuses.every(m => (m.slots_restants ?? 0) === 0);

          if (allComplete) {
            console.log('✅ All rosters complete — no next round needed. Auction phase finished.');
          } else {
            const deadlineAt = new Date();
            deadlineAt.setHours(deadlineAt.getHours() + 24);
            
            const { error: openError } = await supabase.functions.invoke('ouvrir-nouveau-round', {
              body: {
                phase_id: currentAuction.phase_id,
                deadline_at: deadlineAt.toISOString(),
                league_id: currentAuction.league_id,
                auto_launched: true
              }
            });
            
            if (openError) {
              console.error('❌ Error auto-launching next round:', openError);
            } else {
              console.log('✅ Next round auto-launched successfully with deadline:', deadlineAt.toISOString());
            }
          }
        }
      }

      // Generate announcement text
      let text = '';
      if (annonce.type === 'gain') {
        const losersList = (annonce.losers_json as any[])
          .map((l) => `${l.manager} (${l.montant.toFixed(1)})`)
          .join(' · ');

        text = `🥁 [Round ${annonce.round_number}] ${annonce.coureurs.nom} — ${t.wonBy} ${annonce.managers.nom} ${t.at} ${annonce.winning_amount.toFixed(1)}.\n${losersList ? `${t.losers} : ${losersList}.` : ''}`;
      } else {
        const exAequoList = (annonce.losers_json as any[])
          .map((l) => l.manager)
          .join(', ');

        text = `🟨 [Round ${annonce.round_number}] ${annonce.coureurs.nom} — ${t.tie} ${annonce.winning_amount.toFixed(1)} ${t.between} : ${exAequoList}.\n${t.nextRound}.`;
      }

      return new Response(
        JSON.stringify({ success: true, annonce, text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error publishing annonce:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
