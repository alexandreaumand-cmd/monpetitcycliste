import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find deadlines approaching within 1 hour that haven't been reminded yet
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: upcomingDeadlines, error: dlError } = await adminClient
      .from('arena_pronostic_deadlines')
      .select('id, course_id, etape_numero, pronostic_type, deadline_at, courses(nom)')
      .gt('deadline_at', now.toISOString())
      .lte('deadline_at', oneHourLater.toISOString())
      .is('reminder_sent_at', null);

    if (dlError) {
      console.error('[reminder] Deadline fetch error:', dlError);
      throw dlError;
    }

    if (!upcomingDeadlines || upcomingDeadlines.length === 0) {
      console.log('[reminder] No upcoming deadlines to remind about');
      return new Response(JSON.stringify({ sent: false, reason: 'No upcoming deadlines' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[reminder] Found ${upcomingDeadlines.length} upcoming deadline(s)`);

    // Group deadlines by their deadline_at (same time = same notification)
    const groupedByTime: Record<string, typeof upcomingDeadlines> = {};
    for (const dl of upcomingDeadlines) {
      const key = dl.deadline_at;
      if (!groupedByTime[key]) groupedByTime[key] = [];
      groupedByTime[key].push(dl);
    }

    // Build notification message for each group
    for (const [deadlineTime, deadlines] of Object.entries(groupedByTime)) {
      const courseNames = deadlines.map(dl => {
        const courseName = (dl.courses as any)?.nom || dl.course_id;
        if (dl.pronostic_type === 'stage_winner' && dl.etape_numero) {
          return `${courseName} - Étape ${dl.etape_numero}`;
        } else if (dl.pronostic_type === 'gc_winner') {
          return `${courseName} - CG`;
        }
        return courseName;
      });

      const title = '🎯 Pronostics bientôt clos !';
      const message = courseNames.length === 1
        ? `Plus qu'1h pour pronostiquer : ${courseNames[0]}`
        : `Plus qu'1h pour pronostiquer : ${courseNames.join(', ')}`;

      console.log(`[reminder] Sending broadcast: ${message}`);

      // Send broadcast push notification
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            broadcast: true,
            title,
            message,
            type: 'pronostic_reminder',
            metadata: {
              deadline_at: deadlineTime,
              course_names: courseNames,
            },
          }),
        });

        const pushResult = await pushResponse.json();
        console.log('[reminder] Push result:', pushResult);
      } catch (pushError) {
        console.error('[reminder] Push error:', pushError);
      }
    }

    // Mark all processed deadlines as reminded
    const deadlineIds = upcomingDeadlines.map(dl => dl.id);
    const { error: updateError } = await adminClient
      .from('arena_pronostic_deadlines')
      .update({ reminder_sent_at: now.toISOString() })
      .in('id', deadlineIds);

    if (updateError) {
      console.error('[reminder] Update reminder_sent_at error:', updateError);
    }

    return new Response(JSON.stringify({
      sent: true,
      deadlines_reminded: deadlineIds.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[reminder] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
