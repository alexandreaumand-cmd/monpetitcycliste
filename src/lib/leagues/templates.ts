import { supabase } from "@/integrations/supabase/client";

export type GameMode = 'full_season' | 'short_gt' | 'short_wt' | 'short_classics';

export type LeagueTemplate = {
  id: GameMode;
  name: string;
  description: string;
  playerCounts: number[];
  defaultBudget: number;
  defaultMaxRiders: number;
  budgetMultiplierPerPlayer: number;
  ridersMultiplierPerPlayer: number;
  phaseIndexes: number[];
  auctionStrategy: 'single' | 'per_phase' | 'grouped';
  auctionPhaseGroups?: number[][];
  courseFilters: {
    wt_tier?: string[];
    categorie?: string[];
    competitions?: string[];
    exclude_proseries?: boolean;
  };
  scopeConfig: {
    byPhase: boolean;
    gtOnly: boolean;
    wtOnly: boolean;
    phases: string[];
    competitions: string[];
  };
};

// Fallback templates if DB is unavailable
export const FALLBACK_TEMPLATES: LeagueTemplate[] = [
  {
    id: 'full_season',
    name: 'Saison Complète',
    description: 'Toutes les phases de la saison',
    playerCounts: [4, 6, 8, 10],
    defaultBudget: 2200,
    defaultMaxRiders: 30,
    budgetMultiplierPerPlayer: 0.15,
    ridersMultiplierPerPlayer: 0.10,
    phaseIndexes: [1, 2, 3, 4, 5],
    auctionStrategy: 'per_phase',
    courseFilters: {},
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
    budgetMultiplierPerPlayer: 0.15,
    ridersMultiplierPerPlayer: 0.10,
    phaseIndexes: [3, 4],
    auctionStrategy: 'single',
    courseFilters: { wt_tier: ['GT'] },
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
    budgetMultiplierPerPlayer: 0.15,
    ridersMultiplierPerPlayer: 0.10,
    phaseIndexes: [1, 2, 3, 4, 5],
    auctionStrategy: 'per_phase',
    courseFilters: { exclude_proseries: true },
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
    budgetMultiplierPerPlayer: 0.15,
    ridersMultiplierPerPlayer: 0.10,
    phaseIndexes: [1, 2],
    auctionStrategy: 'single',
    courseFilters: {
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

export async function getLeagueTemplates(): Promise<LeagueTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('league_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    // Transform DB format to frontend format
    return (data || []).map(t => ({
      id: t.id as GameMode,
      name: t.name,
      description: t.description,
      playerCounts: t.player_counts,
      defaultBudget: t.base_budget,
      defaultMaxRiders: t.base_max_riders,
      budgetMultiplierPerPlayer: Number(t.budget_multiplier_per_player),
      ridersMultiplierPerPlayer: Number(t.riders_multiplier_per_player),
      phaseIndexes: t.phase_indexes || [1, 2, 3, 4, 5],
      auctionStrategy: (t.auction_strategy as 'single' | 'per_phase' | 'grouped') || 'per_phase',
      auctionPhaseGroups: t.auction_phase_groups ? (t.auction_phase_groups as any as number[][]) : undefined,
      courseFilters: (t.course_filters as any) || {},
      scopeConfig: {
        byPhase: t.by_phase,
        gtOnly: t.gt_only,
        wtOnly: t.wt_only,
        phases: [],
        competitions: t.competitions,
      },
    }));
  } catch (error) {
    console.error('Failed to load templates from DB, using fallback:', error);
    return FALLBACK_TEMPLATES;
  }
}

export async function calculateLeagueSettings(mode: GameMode, playerCount: number) {
  const templates = await getLeagueTemplates();
  const template = templates.find((t) => t.id === mode);
  
  if (!template) {
    throw new Error(`Invalid game mode: ${mode}`);
  }

  // Budget formula: base_budget * (1 + (players - 4) * multiplier)
  const budgetMultiplier = 1 + ((playerCount - 4) * template.budgetMultiplierPerPlayer);
  const budget = Math.round(template.defaultBudget * budgetMultiplier);

  // Max riders formula: base_max_riders * (1 + (players - 4) * multiplier)
  const ridersMultiplier = 1 + ((playerCount - 4) * template.ridersMultiplierPerPlayer);
  const maxRiders = Math.round(template.defaultMaxRiders * ridersMultiplier);

  return {
    budget,
    maxRiders,
  };
}

export async function getLeagueScopeConfig(mode: GameMode, seasonId: string) {
  const templates = await getLeagueTemplates();
  const template = templates.find((t) => t.id === mode);
  
  if (!template) {
    throw new Error(`Invalid game mode: ${mode}`);
  }

  return {
    seasonId,
    phaseIndexes: template.phaseIndexes,
    auctionStrategy: template.auctionStrategy,
    auctionPhaseGroups: template.auctionPhaseGroups,
    courseFilters: template.courseFilters,
    byPhase: template.scopeConfig.byPhase,
    gtOnly: template.scopeConfig.gtOnly,
    wtOnly: template.scopeConfig.wtOnly,
    phases: template.scopeConfig.phases,
    competitions: template.scopeConfig.competitions,
  };
}
