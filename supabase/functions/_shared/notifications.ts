export async function notifyLeagueMembers(
  supabase: any,
  leagueId: string,
  notification: {
    type: 'auction_opened' | 'auction_closed';
    title: string;
    message: string;
    metadata: any;
  }
) {
  try {
    // Get all managers of the league
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select(`
        user_id,
        managers!inner(id)
      `)
      .eq('league_id', leagueId);
    
    if (membersError) {
      console.error('Error fetching league members for notifications:', membersError);
      return;
    }

    if (!members || members.length === 0) {
      console.log('No members found for league:', leagueId);
      return;
    }
    
    // Create a notification for each member
    const notifications = members.map(member => ({
      manager_id: member.managers.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      is_read: false
    }));
    
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (insertError) {
      console.error('Error inserting notifications:', insertError);
    } else {
      console.log(`✅ Created ${notifications.length} notifications for league ${leagueId}`);
    }
  } catch (error) {
    console.error('Error in notifyLeagueMembers:', error);
  }
}
