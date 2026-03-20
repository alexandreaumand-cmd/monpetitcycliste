/**
 * Course type normalization utilities
 * 
 * Canonical values in database: "one_day", "stage_race"
 * Legacy values may still appear from imports: "One-day race", "Stages race", "etapes", etc.
 */

export interface NormalizedCourseType {
  isStage: boolean;
  canonicalForRules: string;  // For scoring_rules.type matching
  display: string;             // For UI display
  dbIlike: string;            // For database .ilike() queries
}

export function normalizeCourseType(typeValue: string | null | undefined): NormalizedCourseType {
  const raw = (typeValue || '').trim();
  const normalized = raw.toLowerCase();
  
  // Canonical match first
  if (normalized === 'stage_race') {
    return { isStage: true, canonicalForRules: 'stage races', display: 'Stage race', dbIlike: '%stage%' };
  }
  if (normalized === 'one_day') {
    return { isStage: false, canonicalForRules: 'one day race', display: 'One day', dbIlike: '%one%' };
  }
  
  // Fallback for legacy/import values
  const isStage = normalized.includes('stage') || 
                  normalized.includes('etape') || 
                  normalized.includes('étape');
  
  return {
    isStage,
    canonicalForRules: isStage ? 'stage races' : 'one day race',
    display: isStage ? 'Stage race' : 'One day',
    dbIlike: isStage ? '%stage%' : '%one%',
  };
}

export function isStageRace(typeValue: string | null | undefined): boolean {
  return normalizeCourseType(typeValue).isStage;
}
