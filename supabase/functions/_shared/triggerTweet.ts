// Fire-and-forget trigger for the automatic X (Twitter) publication.
// Never throws: a publication problem must not break a result save.
export async function triggerResultTweet(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  course_id: string;
  kind: 'stage' | 'gc' | 'oneday';
  etape_numero?: number | null;
}) {
  const { supabaseUrl, serviceRoleKey, course_id, kind, etape_numero } = params;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/tweet-race-result`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ course_id, kind, etape_numero: etape_numero ?? null }),
    });
    const body = await res.text();
    console.log(`[tweet] ${kind} ${course_id}/${etape_numero ?? 'final'} -> ${res.status}: ${body}`);
  } catch (error) {
    console.error('[tweet] trigger failed:', error instanceof Error ? error.message : error);
  }
}
