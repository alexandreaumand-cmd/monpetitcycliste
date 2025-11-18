/**
 * Génère un ID unique pour un coureur basé sur son nom
 * Format: 3 premières lettres du nom en majuscules + 3 chiffres aléatoires
 * Ex: "Tadej Pogačar" => "POG427"
 */
export const generateCoureurId = (nom: string): string => {
  // Nettoyer le nom et prendre le nom de famille (dernier mot)
  const parts = nom.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  
  // Normaliser les caractères accentués
  const normalized = lastName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  
  // Prendre les 3 premières lettres (ou compléter avec X si trop court)
  const prefix = (normalized + 'XXX').substring(0, 3);
  
  // Générer 3 chiffres aléatoires
  const random = Math.floor(Math.random() * 900) + 100;
  
  return `${prefix}${random}`;
};
