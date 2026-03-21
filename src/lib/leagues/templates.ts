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
 * For "per_course" mode, compute budget and maxRiders based on selected courses.
 * Rules:
 * - 1 one_day only → 8 riders / 650 budget
 * - N one_day only → 10 riders / 800 budget
 * - Any stage_race present → 15 riders / 1100 budget
 */
export function computePerCourseSettings(courses: Array<{ type_course: string | null }>): { budget: number; maxRiders: number } {
  const hasStageRace = courses.some(c => c.type_course === 'stage_race');
  
  if (hasStageRace) {
    return { budget: 1100, maxRiders: 15 };
  }
  
  // All one-day
  if (courses.length === 1) {
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
