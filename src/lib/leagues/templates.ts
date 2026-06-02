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
 * Rules:
 * - At least one Grand Tour (TdF / Giro / Vuelta) → 15 riders / 1100 budget
 * - Otherwise (one-day or non-GT stage races) → 10 riders / 1100 budget
 */
export function computePerCourseSettings(courses: Array<{ nom?: string | null; type_course?: string | null }>): { budget: number; maxRiders: number } {
  const hasGrandTour = courses.some(c => isGrandTour(c.nom));
  if (hasGrandTour) {
    return { budget: 1100, maxRiders: 15 };
  }
  return { budget: 1100, maxRiders: 10 };
}

/**
 * For "five_phases" mode, budget and riders are always fixed.
 */
export function computeFivePhasesSettings(): { budget: number; maxRiders: number } {
  return { budget: 2200, maxRiders: 30 };
}
