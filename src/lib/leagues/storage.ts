const LEAGUE_KEY = 'mpc.currentLeagueId';

export function getStoredLeagueId(): string | null {
  try {
    return localStorage.getItem(LEAGUE_KEY);
  } catch {
    return null;
  }
}

export function setStoredLeagueId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(LEAGUE_KEY, id);
    } else {
      localStorage.removeItem(LEAGUE_KEY);
    }
  } catch {
    // Silent fail in case localStorage is not available
  }
}

export function clearStoredLeagueId(): void {
  setStoredLeagueId(null);
}
