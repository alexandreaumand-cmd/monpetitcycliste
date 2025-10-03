/**
 * Normalize string by removing accents and converting to lowercase
 * Used for accent-insensitive search
 */
export const normalizeString = (str: string): string => 
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
