import type { GameMode, FivePhasesVariant } from './types';

export type { GameMode } from './types';

export type LeagueTemplate = {
  id: GameMode;
  name: string;
  description: string;
  playerCounts: number[];
  defaultBudget: number;
  defaultMaxRiders: number;
  auctionStrategy: 'single' | 'per_phase';
};

export const TEMPLATES: Record<'five_phases' | 'per_course', LeagueTemplate> = {
  five_phases: {
    id: 'five_phases',
    name: 'Mode 5 Phases',
    description: 'Saison complète ou World Tour, enchères par phase',
    playerCounts: [3, 4, 5, 6, 7, 8, 9, 10],
    defaultBudget: 2200,
    defaultMaxRiders: 30,
    auctionStrategy: 'per_phase',
  },
  per_course: {
    id: 'per_course',
    name: 'Mode À la course',
    description: 'Choisissez vos courses, enchère unique',
    playerCounts: [3, 4, 5, 6, 7, 8, 9, 10],
    defaultBudget: 650,
    defaultMaxRiders: 8,
    auctionStrategy: 'single',
  },
};

export function getTemplates(): LeagueTemplate[] {
  return [TEMPLATES.five_phases, TEMPLATES.per_course];
}

/**
 * Detect Grand Tours by name (Tour de France, Giro d'Italia, La Vuelta).
 * The `wt_tier` column in DB is inconsistent and cannot be trusted for this.
 */
export function isGrandTour(nom: string | null | undefined): boolean {
  const n = (nom || '').toLowerCase();
  if (n.includes('tour de france')) return true;
  if (n.includes("giro d'italia") || n.includes('giro d italia')) return true;
  if (n.includes('vuelta') && n.includes('espa')) return true;
  return false;
}

/**
 * For "per_course" mode, compute budget and maxRiders based on selected courses.
 * Priorité : GT > CPE non-GT > classiques (1 ou plusieurs).
 * - Au moins 1 Grand Tour → 1100 / 15
 * - Au moins 1 course par étapes non-GT → 1100 / 10
 * - 1 seule classique (one_day) → 650 / 8
 * - Plusieurs classiques (one_day) → 800 / 10
 */
export function computePerCourseSettings(courses: Array<{ nom?: string | null; type_course?: string | null }>): { budget: number; maxRiders: number } {
  if (courses.some(c => isGrandTour(c.nom))) {
    return { budget: 1100, maxRiders: 15 };
  }
  if (courses.some(c => c.type_course === 'stage_race')) {
    return { budget: 1100, maxRiders: 10 };
  }
  if (courses.length <= 1) {
    return { budget: 650, maxRiders: 8 };
  }
  return { budget: 800, maxRiders: 10 };
}

/**
 * For "five_phases" mode, budget and riders are always fixed.
 */
export function computeFivePhasesSettings(): { budget: number; maxRiders: number } {
  return { budget: 2200, maxRiders: 30 };
}
