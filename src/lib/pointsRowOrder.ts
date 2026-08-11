/**
 * Tri d'affichage des lignes de points d'une course :
 * 1. Les classements finaux (Général, Montagne, Points/Vert, Jeune)
 * 2. Puis par numéro d'étape croissant : d'abord le classement de l'étape,
 *    ensuite les porteurs de maillots.
 */

export interface PointsRowLike {
  type_classement?: string | null;
  etape_numero?: number | null;
}

const FINAL_ORDER = ["general", "points", "montagne", "jeune"];

function normalize(type?: string | null) {
  return (type || "").toLowerCase().trim();
}

function isPorteur(type?: string | null) {
  return normalize(type).startsWith("porteur");
}

function finalRank(type?: string | null): number {
  const t = normalize(type);
  if (t === "general" || t === "général" || t === "gc") return 0;
  if (t === "points" || t === "vert") return 1;
  if (t === "montagne" || t === "gpm" || t === "mountain") return 2;
  if (t === "jeune" || t === "youth") return 3;
  return FINAL_ORDER.length;
}

function isStage(type?: string | null) {
  const t = normalize(type);
  return t === "etape" || t === "étape" || t === "stage";
}

export function comparePointsRows(a: PointsRowLike, b: PointsRowLike): number {
  const aFinal = !a.etape_numero && !isPorteur(a.type_classement);
  const bFinal = !b.etape_numero && !isPorteur(b.type_classement);

  // 1. Classements finaux d'abord
  if (aFinal !== bFinal) return aFinal ? -1 : 1;
  if (aFinal && bFinal) {
    const diff = finalRank(a.type_classement) - finalRank(b.type_classement);
    if (diff !== 0) return diff;
    return normalize(a.type_classement).localeCompare(normalize(b.type_classement));
  }

  // 2. Par numéro d'étape
  const aEtape = a.etape_numero ?? Number.MAX_SAFE_INTEGER;
  const bEtape = b.etape_numero ?? Number.MAX_SAFE_INTEGER;
  if (aEtape !== bEtape) return aEtape - bEtape;

  // 3. Classement de l'étape avant les porteurs de maillots
  const aWeight = isStage(a.type_classement) ? 0 : isPorteur(a.type_classement) ? 2 : 1;
  const bWeight = isStage(b.type_classement) ? 0 : isPorteur(b.type_classement) ? 2 : 1;
  if (aWeight !== bWeight) return aWeight - bWeight;

  return normalize(a.type_classement).localeCompare(normalize(b.type_classement));
}

export function sortPointsRows<T extends PointsRowLike>(rows: T[]): T[] {
  return [...rows].sort(comparePointsRows);
}
