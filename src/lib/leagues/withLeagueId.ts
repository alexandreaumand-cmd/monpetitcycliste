import { useLeague } from "@/contexts/LeagueContext";

/**
 * Hook pour forcer la présence de league_id sur toutes les écritures "jeu"
 * Évite les oublis et centralise la logique de rattachement à la ligue
 */
export function useWithLeagueId() {
  const { leagueId } = useLeague();

  /**
   * Attache automatiquement le league_id au payload
   * @throws Error si leagueId est manquant
   */
  function attach<T extends object>(payload: T): T & { league_id: string } {
    if (!leagueId) {
      throw new Error("league_id missing in context - impossible to write game data");
    }
    return { ...payload, league_id: leagueId };
  }

  /**
   * Attache league_id à un tableau de payloads
   */
  function attachMany<T extends object>(payloads: T[]): Array<T & { league_id: string }> {
    if (!leagueId) {
      throw new Error("league_id missing in context - impossible to write game data");
    }
    return payloads.map(p => ({ ...p, league_id: leagueId }));
  }

  return { 
    attach, 
    attachMany,
    leagueId 
  };
}
