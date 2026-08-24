/**
 * Helpers used when a league is created from an existing one ("clone" flow).
 * Course ids are season-scoped, so when the target season differs from the
 * source season we remap the selection by normalized race name.
 */

export function normalizeCourseName(nom: string | null | undefined): string {
  return (nom || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type RemapResult = {
  /** Course ids found in the target season. */
  ids: string[];
  /** Source race names with no equivalent in the target season. */
  missing: string[];
};

export function remapCourseNames(
  sourceNames: string[],
  targetCourses: Array<{ id: string; nom: string | null }>,
): RemapResult {
  const byName = new Map<string, string>();
  for (const c of targetCourses) {
    const key = normalizeCourseName(c.nom);
    if (key && !byName.has(key)) byName.set(key, c.id);
  }

  const ids: string[] = [];
  const missing: string[] = [];
  for (const nom of sourceNames) {
    const id = byName.get(normalizeCourseName(nom));
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      missing.push(nom);
    }
  }
  return { ids, missing };
}
