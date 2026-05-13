// Sends a transactional email to all members of a league, filtered by their
// email_preferences (auction_opened / auction_closed). Used for round
// open/close notifications. Fire-and-forget — failures are logged, not thrown.

type PreferenceKey = 'auction_opened' | 'auction_closed';

export async function emailLeagueMembers(
  supabase: any,
  leagueId: string,
  opts: {
    templateName: 'auction-round-opened' | 'auction-round-closed';
    preferenceKey: PreferenceKey;
    idempotencyKey: string;
    templateData: Record<string, any>;
  }
) {
  try {
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId);

    const userIds = (members ?? []).map((m: any) => m.user_id).filter(Boolean) as string[];
    if (userIds.length === 0) return;

    // Resolve emails via managers table (same pattern used elsewhere)
    const { data: managers } = await supabase
      .from('managers')
      .select('user_id, email')
      .in('user_id', userIds);

    // Filter out users who opted-out of this specific preference
    const { data: prefs } = await supabase
      .from('email_preferences')
      .select(`user_id, ${opts.preferenceKey}`)
      .in('user_id', userIds);
    const optedOut = new Set(
      (prefs ?? [])
        .filter((p: any) => p[opts.preferenceKey] === false)
        .map((p: any) => p.user_id)
    );

    const recipients = (managers ?? []).filter(
      (m: any) => m.email && m.user_id && !optedOut.has(m.user_id)
    );

    if (recipients.length === 0) return;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const fnUrl = `${supabaseUrl}/functions/v1/send-transactional-email`;

    await Promise.all(
      recipients.map((r: any) =>
        fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({
            templateName: opts.templateName,
            recipientEmail: r.email,
            idempotencyKey: `${opts.idempotencyKey}-${r.email}`,
            templateData: opts.templateData,
          }),
        }).catch((e) => console.error('email send failed', r.email, e))
      )
    );
  } catch (e) {
    console.error('emailLeagueMembers failed:', e);
  }
}
