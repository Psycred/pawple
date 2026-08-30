/**
 * Pure helpers for active-pet selection and stale-storage healing.
 * Used by ActivePetContext init and covered by unit tests (Fix 3C).
 */

/**
 * Resolve which pet should be active on startup.
 * Validates saved storage against the user's current pets (oldest first).
 *
 * @param {string|null|undefined} savedId
 * @param {{ id: string|number, created_at?: string }[]|null|undefined} pets
 * @returns {string|null}
 */
export function resolveInitialActivePetId(savedId, pets) {
  const ordered = [...(pets ?? [])].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );
  const ids = ordered.map((p) => String(p.id));

  if (savedId != null && savedId !== '' && ids.includes(String(savedId))) {
    return String(savedId);
  }

  return ids[0] ?? null;
}

/**
 * After deleting a pet, pick the next active pet when the deleted pet was active.
 * Returns null when the active pet should clear (last pet deleted).
 * Returns undefined when the active pet should not change (non-active delete).
 *
 * @param {string|null|undefined} activePetId
 * @param {string|number} deletedPetId
 * @param {{ id: string|number, created_at?: string }[]} remainingPets
 * @returns {string|null|undefined}
 */
export function resolveActivePetAfterDelete(activePetId, deletedPetId, remainingPets) {
  if (String(activePetId) !== String(deletedPetId)) {
    return undefined;
  }

  const ordered = [...(remainingPets ?? [])].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );

  return ordered[0]?.id != null ? String(ordered[0].id) : null;
}
