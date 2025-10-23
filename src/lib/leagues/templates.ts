export type GameMode = 'full_season' | 'short_gt' | 'short_wt' | 'short_classics';

export type LeagueTemplate = {
  id: GameMode;
  name: string;
  description: string;
  playerCounts: number[];
  defaultBudget: number;
  defaultMaxRiders: number;
  scopeConfig: {
    byPhase: boolean;
    gtOnly: boolean;
    wtOnly: boolean;
    phases: string[];
    competitions: string[];
  };
};

export const LEAGUE_TEMPLATES: LeagueTemplate[] = [
  {
    id: 'full_season',
    name: 'Saison Complète',
    description: 'Toutes les phases de la saison',
    playerCounts: [4, 6, 8, 10],
    defaultBudget: 2200,
    defaultMaxRiders: 30,
    scopeConfig: {
      byPhase: true,
      gtOnly: false,
      wtOnly: false,
      phases: [],
      competitions: [],
    },
  },
  {
    id: 'short_gt',
    name: 'Grands Tours',
    description: 'Tour, Giro, Vuelta uniquement',
    playerCounts: [4, 6, 8, 10],
    defaultBudget: 1500,
    defaultMaxRiders: 22,
    scopeConfig: {
      byPhase: false,
      gtOnly: true,
      wtOnly: false,
      phases: [],
      competitions: ['Tour de France', 'Giro d\'Italia', 'Vuelta a España'],
    },
  },
  {
    id: 'short_wt',
    name: 'World Tour',
    description: 'Courses World Tour uniquement',
    playerCounts: [4, 6, 8, 10],
    defaultBudget: 1800,
    defaultMaxRiders: 26,
    scopeConfig: {
      byPhase: false,
      gtOnly: false,
      wtOnly: true,
      phases: [],
      competitions: [],
    },
  },
  {
    id: 'short_classics',
    name: 'Classiques',
    description: 'Monuments et classiques majeures',
    playerCounts: [4, 6, 8, 10],
    defaultBudget: 1200,
    defaultMaxRiders: 18,
    scopeConfig: {
      byPhase: false,
      gtOnly: false,
      wtOnly: false,
      phases: [],
      competitions: [
        'Milano-Sanremo',
        'Ronde van Vlaanderen',
        'Paris-Roubaix',
        'Liège-Bastogne-Liège',
        'Il Lombardia',
        'Strade Bianche',
        'Amstel Gold Race',
        'La Flèche Wallonne',
      ],
    },
  },
];

export function calculateLeagueSettings(mode: GameMode, playerCount: number) {
  const template = LEAGUE_TEMPLATES.find((t) => t.id === mode);
  if (!template) {
    throw new Error(`Invalid game mode: ${mode}`);
  }

  // Budget formula: base_budget * (1 + (players - 4) * 0.15)
  const budgetMultiplier = 1 + ((playerCount - 4) * 0.15);
  const budget = Math.round(template.defaultBudget * budgetMultiplier);

  // Max riders formula: base_max_riders * (1 + (players - 4) * 0.1)
  const ridersMultiplier = 1 + ((playerCount - 4) * 0.1);
  const maxRiders = Math.round(template.defaultMaxRiders * ridersMultiplier);

  return {
    budget,
    maxRiders,
  };
}

export function getLeagueScopeConfig(mode: GameMode, seasonId: string) {
  const template = LEAGUE_TEMPLATES.find((t) => t.id === mode);
  if (!template) {
    throw new Error(`Invalid game mode: ${mode}`);
  }

  return {
    seasonId,
    byPhase: template.scopeConfig.byPhase,
    gtOnly: template.scopeConfig.gtOnly,
    wtOnly: template.scopeConfig.wtOnly,
    phases: template.scopeConfig.phases,
    competitions: template.scopeConfig.competitions,
  };
}
