/**
 * Normalize string by removing accents and converting to lowercase
 * Used for accent-insensitive search
 */
export const normalizeString = (str: string): string => 
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Format classification label for display
 */
export const formatClassementLabel = (type: string, etape?: number | null): string => {
  if (type === 'Etape' && etape) {
    return `Étape ${etape}`;
  }
  const labels: Record<string, string> = {
    'GC': 'CG',
    'Points': 'Points',
    'Montagne': 'Montagne',
    'Jeune': 'Jeunes',
  };
  return labels[type] || type;
};
