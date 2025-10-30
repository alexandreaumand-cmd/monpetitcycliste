export const EQUIPE_CATEGORIES = {
  WT: 'WorldTeam',
  PT: 'ProTeam',
  CT: 'Continental'
} as const;

export type EquipeCategorie = keyof typeof EQUIPE_CATEGORIES;

export interface Equipe {
  id: string;
  code_court: string;
  nom_complet: string;
  pays?: string;
  logo_url?: string;
}

export interface EquipeSaison extends Equipe {
  categorie?: EquipeCategorie;
  nom_affiche: string;
  saison_id: string;
}

export function getCategorieName(categorie?: string): string {
  if (!categorie) return '';
  return EQUIPE_CATEGORIES[categorie as EquipeCategorie] || categorie;
}
