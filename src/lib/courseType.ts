/**
 * Course type normalization utilities
 * 
 * Handles inconsistent naming between database and application:
 * - Database: "One-day race", "Stages race" 
 * - Scoring rules: "one day race", "stage races"
 * - Display: "One day", "Stage race"
 */

export interface NormalizedCourseType {
  isStage: boolean;
  canonicalForRules: string;  // For scoring_rules.type matching
  display: string;             // For UI display
  dbIlike: string;            // For database .ilike() queries
}

export function normalizeCourseType(typeValue: string | null | undefined): NormalizedCourseType {
  const normalized = (typeValue || '').toLowerCase().trim();
  // Check for various stage race indicators: 'stage', 'stages', 'etapes', 'étape', 'étapes'
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
