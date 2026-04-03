// Helper function to send push notifications to users
async function sendPushNotifications(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userIds: string[],
  notification: { title: string; message: string; type: string; metadata?: any }
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        user_ids: userIds,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        metadata: notification.metadata || {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Push notification failed:', errorText);
    } else {
      const result = await response.json();
      console.log(`📲 Push notifications sent: ${result.sent} success, ${result.failed} failed`);
    }
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

// Send auction-opened emails to league members
async function sendAuctionEmails(
  supabaseUrl: string,
  supabaseServiceKey: string,
  supabase: any,
  userIds: string[],
  metadata: any
) {
  // Get emails from auth.users for all member user_ids
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('Error fetching auth users for emails:', authError);
    return;
  }

  const userEmails = authUsers?.users
    ?.filter((u: any) => userIds.includes(u.id) && u.email)
    ?.map((u: any) => u.email) || [];

  if (userEmails.length === 0) {
    console.log('No emails found for league members');
    return;
  }

  console.log(`📧 Sending auction-opened emails to ${userEmails.length} members`);

  // Send email to each member via send-transactional-email
  const sendPromises = userEmails.map((email: string) =>
    fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_name: 'auction-opened',
        recipient_email: email,
        templateData: {
          leagueName: metadata.league_name || 'Ma Ligue',
          roundNumber: metadata.round_number || 1,
          deadlineAt: metadata.deadline_at || '',
          leagueId: metadata.league_id || '',
          lang: 'fr',
        },
      }),
    }).catch((err: any) => console.error(`Email send failed for ${email}:`, err))
  );

  await Promise.allSettled(sendPromises);
  console.log(`📧 Auction email batch complete`);
}

export async function notifyLeagueMembers(
  supabase: any,
  leagueId: string,
  notification: {
    type: 'auction_opened' | 'auction_closed' | 'auction_ready_to_close' | 'auction_validation';
    title: string;
    message: string;
    metadata: any;
  }
) {
  try {
    // Step 1: Get all user_ids from league members
    const { data: leagueMembers, error: membersError } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId);
    
    if (membersError) {
      console.error('Error fetching league members for notifications:', membersError);
      return;
    }

    if (!leagueMembers || leagueMembers.length === 0) {
      console.log('No members found for league:', leagueId);
      return;
    }

    console.log(`📋 Found ${leagueMembers.length} league members for league ${leagueId}`);

    // Step 2: Get managers for these user_ids
    const userIds = leagueMembers.map((m: any) => m.user_id);
    const { data: members, error: managersError } = await supabase
      .from('managers')
      .select('id, user_id, nom')
      .in('user_id', userIds);
    
    if (managersError) {
      console.error('Error fetching managers for notifications:', managersError);
      return;
    }

    if (!members || members.length === 0) {
      console.log('No managers found for league members');
      return;
    }

    console.log(`👥 Retrieved ${members.length} managers for notifications`);
    
    // Create a notification for each manager
    const notifications = members.map((manager: any) => ({
      manager_id: manager.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      is_read: false
    }));

    console.log(`📤 Preparing ${notifications.length} notifications`);
    
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (insertError) {
      console.error('Error inserting notifications:', insertError);
    } else {
      console.log(`✅ Created ${notifications.length} notifications for league ${leagueId}`);
    }

    // Send push notifications to all league members
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseServiceKey) {
      await sendPushNotifications(
        supabaseUrl,
        supabaseServiceKey,
        userIds,
        notification
      );

      // Send auction-opened emails when an auction opens
      if (notification.type === 'auction_opened' && notification.metadata) {
        try {
          await sendAuctionEmails(
            supabaseUrl,
            supabaseServiceKey,
            supabase,
            userIds,
            notification.metadata
          );
        } catch (emailError) {
          console.error('Error sending auction emails (non-blocking):', emailError);
        }
      }
    }
  } catch (error) {
    console.error('Error in notifyLeagueMembers:', error);
  }
}
