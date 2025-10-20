import { fetchLegacyLeagueId } from "@/lib/leagues/legacy";

/**
 * S'assure qu'on a un leagueId valide
 * Fallback sur Legacy si pas de ligue courante
 */
export async function ensureLeagueId(current: string | null | undefined): Promise<string> {
  return current ?? await fetchLegacyLeagueId();
}
