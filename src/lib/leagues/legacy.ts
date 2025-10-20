import { supabase } from "@/integrations/supabase/client";

let cachedLegacyId: string | null = null;

export async function fetchLegacyLeagueId(): Promise<string> {
  // Return cached value if available
  if (cachedLegacyId) {
    return cachedLegacyId;
  }

  // Try to find "Ligue Legacy" by name
  const { data: legacyByName } = await supabase
    .from('leagues')
    .select('id')
    .ilike('name', 'Ligue Legacy')
    .limit(1)
    .single();

  if (legacyByName?.id) {
    cachedLegacyId = legacyByName.id;
    return cachedLegacyId;
  }

  // Fallback: get the oldest league (created during migration)
  const { data: oldestLeague } = await supabase
    .from('leagues')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (oldestLeague?.id) {
    cachedLegacyId = oldestLeague.id;
    return cachedLegacyId;
  }

  throw new Error('No legacy league found. Please run the Phase 2 migration.');
}

export function clearLegacyCache(): void {
  cachedLegacyId = null;
}
