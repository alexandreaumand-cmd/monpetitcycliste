type OwnerLike = { manager_id: string; manager_nom: string; phase_id?: string; phase_index?: number };

/**
 * Build a map manager_id -> sorted list of phase labels (e.g. ["P1", "P3"])
 * from the `owners_by_phase` payload returned by the get-top-riders function.
 * Accepts both the record form ({ "P1": [owner, ...] }) and the array form.
 */
export function getPhasesByManager(
  ownersByPhase: Record<string, OwnerLike[]> | OwnerLike[] | undefined | null,
): Record<string, string[]> {
  const acc: Record<string, Set<number>> = {};
  const unknown: Record<string, Set<string>> = {};

  const push = (managerId: string, label: string) => {
    const match = /^P(\d+)$/.exec(label);
    if (match) {
      (acc[managerId] ??= new Set()).add(Number(match[1]));
    } else if (label) {
      (unknown[managerId] ??= new Set()).add(label);
    }
  };

  if (Array.isArray(ownersByPhase)) {
    for (const owner of ownersByPhase) {
      if (!owner?.manager_id) continue;
      if (owner.phase_index) push(owner.manager_id, `P${owner.phase_index}`);
    }
  } else if (ownersByPhase && typeof ownersByPhase === 'object') {
    for (const [phaseKey, owners] of Object.entries(ownersByPhase)) {
      for (const owner of owners || []) {
        if (!owner?.manager_id) continue;
        push(owner.manager_id, phaseKey);
      }
    }
  }

  const result: Record<string, string[]> = {};
  const managerIds = new Set([...Object.keys(acc), ...Object.keys(unknown)]);
  for (const managerId of managerIds) {
    const numeric = [...(acc[managerId] ?? [])].sort((a, b) => a - b).map((n) => `P${n}`);
    result[managerId] = numeric;
  }
  return result;
}
