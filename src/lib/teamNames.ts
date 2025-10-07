export const TEAM_FULL_NAMES: Record<string, string> = {
  "ALM": "Alpecin-Deceuninck",
  "AST": "Astana Qazaqstan",
  "TBV": "Bahrain Victorious",
  "BOH": "BORA-hansgrohe",
  "COF": "Cofidis",
  "DQT": "Deceuninck-Quick Step",
  "EFE": "EF Education-EasyPost",
  "GFC": "Groupama-FDJ",
  "IWG": "Intermarché-Wanty",
  "IPT": "Israel-Premier Tech",
  "JAY": "Team Jayco AlUla",
  "LTD": "Lidl-Trek",
  "MOV": "Movistar Team",
  "IPO": "INEOS Grenadiers",
  "SOQ": "Soudal Quick-Step",
  "DSM": "Team dsm-firmenich PostNL",
  "TJV": "Team Visma | Lease a Bike",
  "UAD": "UAE Team Emirates",
  "UXT": "Uno-X Mobility",
  "ARK": "Arkéa-B&B Hotels",
  "CPT": "Cofidis",
  "TNN": "TotalEnergies",
  "LTS": "Lotto Dstny",
  "SVB": "Soudal-Quick Step",
  "IGD": "INEOS Grenadiers",
  "TFS": "Trek-Segafredo",
  "QST": "Quick-Step Alpha Vinyl",
};

export function getFullTeamName(shortName: string): string {
  return TEAM_FULL_NAMES[shortName] || shortName;
}

export function getTeamOptions(teams: string[]): { short: string; full: string }[] {
  return teams.map(team => ({
    short: team,
    full: getFullTeamName(team),
  })).sort((a, b) => a.full.localeCompare(b.full));
}
