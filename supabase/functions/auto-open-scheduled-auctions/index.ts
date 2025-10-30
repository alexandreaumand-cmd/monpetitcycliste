import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notifyLeagueMembers } from '../_shared/notifications.ts';

Deno.serve(async (req) => {
  console.log('⚠️ auto-open-scheduled-auctions is DISABLED - returning immediately');
  
  return new Response(
    JSON.stringify({ 
      message: 'Function disabled',
      note: 'Auto-opening of scheduled auctions has been disabled. Use manual admin controls to open auctions.'
    }),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
});