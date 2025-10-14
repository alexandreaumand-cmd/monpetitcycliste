/**
 * Helper functions for CSV template generation
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

/**
 * Generate CSV template for courses
 */
export const generateCoursesTemplate = (): string => {
  return `id;nom;categorie;type_course;date_debut;date_fin;phase_id
P1R1;Tour Down Under;WT;etapes;2025-01-21;2025-01-26;Phase 1
P1R2;Tour de Romandie;WT;etapes;2025-04-22;2025-04-27;Phase 1
P1R3;Paris-Roubaix;WT;one_day;2025-04-13;2025-04-13;Phase 1`;
};

/**
 * Generate CSV template for coureurs
 */
export const generateCoureursTemplate = (): string => {
  return `Coureur;Equipe;Prix initial;id
Tadej POGACAR;UAE Team Emirates;120;POG001
Jonas VINGEGAARD;Visma-Lease a Bike;115;VIN001
Remco EVENEPOEL;Soudal Quick-Step;110;EVE001`;
};

/**
 * Generate CSV template for baremes
 */
export const generateBaremesTemplate = (): string => {
  return `id;Catégorie;Type classement;Place;Points;Type
B001;WT;General;1;150;race
B002;WT;General;2;120;race
B003;WT;General;3;100;race
B004;WT;Etape;1;25;stage
B005;WT;Etape;2;20;stage`;
};

/**
 * Generate CSV template for rosters
 */
export const generateRostersTemplate = (): string => {
  return `Coureur;Propriétaire;Phase;Prix
Tadej POGACAR;John Doe;Phase 1;120
Jonas VINGEGAARD;Jane Smith;Phase 1;115
Remco EVENEPOEL;John Doe;Phase 1;110`;
};

/**
 * Generate CSV template for resultats
 */
export const generateResultatsTemplate = (): string => {
  return `course_id;coureur_id;type_classement;position;statut;etape_numero;date_classement
P1R1;POG001;General;1;finished;;2025-01-26
P1R1;VIN001;General;2;finished;;2025-01-26
P1R1;EVE001;General;3;finished;;2025-01-26
P1R1;POG001;Etape;1;finished;1;2025-01-21
P1R1;VIN001;Etape;2;finished;1;2025-01-21`;
};

/**
 * Helper to trigger download of a CSV file
 */
export const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};
