/**
 * Helper functions for export templates
 */

/**
 * Get jersey icon for a given type_classement
 */
export const getJerseyIcon = (typeClassement: string): string => {
  if (typeClassement.includes("General")) return "🟡";
  if (typeClassement.includes("Vert") || typeClassement.includes("Points")) return "🟢";
  if (typeClassement.includes("Montagne") || typeClassement.includes("Mont")) return "🔴";
  if (typeClassement.includes("Jeune")) return "⚪";
  if (typeClassement.includes("Combatif")) return "🟠";
  return "🎽";
};

/**
 * Get jersey label for a given type_classement
 */
export const getJerseyLabel = (typeClassement: string): string => {
  if (typeClassement.includes("General")) return "Général";
  if (typeClassement.includes("Vert") || typeClassement.includes("Points")) return "Vert";
  if (typeClassement.includes("Montagne") || typeClassement.includes("Mont")) return "Montagne";
  if (typeClassement.includes("Jeune")) return "Jeune";
  if (typeClassement.includes("Combatif")) return "Combativité";
  return typeClassement;
};
