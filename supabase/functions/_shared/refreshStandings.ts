// Refresh the standings materialized views WITHOUT blocking the HTTP response.
// The refresh is heavy (several seconds); callers only need it to happen soon,
// not before they answer the client.

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
};

export function refreshStandingsInBackground(client: RpcClient, tag: string) {
  const task = (async () => {
    try {
      const { error } = await client.rpc('refresh_standings_cache');
      if (error) {
        console.error(`[${tag}] standings refresh error:`, error.message ?? error);
      } else {
        console.log(`[${tag}] standings materialized views refreshed`);
      }
    } catch (e) {
      console.error(`[${tag}] standings refresh threw:`, e);
    }
  })();

  // Supabase edge runtime keeps the isolate alive for tasks passed to waitUntil.
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(task);
  } else {
    task.catch(() => {});
  }
}
