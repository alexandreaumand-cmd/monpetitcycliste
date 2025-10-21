/**
 * Helper de validation pour league_id côté serveur
 */

export function isUuid(v?: string | null): v is string {
  return !!v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
}

/**
 * Extrait league_id depuis le body ou les query params
 */
export function extractLeagueId(body?: any, url?: string): string | null {
  if (body?.league_id) return body.league_id;
  if (body?.leagueId) return body.leagueId;
  
  if (url) {
    const params = new URL(url).searchParams;
    return params.get("league_id") || params.get("leagueId");
  }
  
  return null;
}
