/**
 * Pure pet-block visibility helpers — no Supabase dependency (safe for unit tests).
 */

export function isBlockedByPetIds(petIds, blockedPetIds) {
  const blocked = blockedPetIds instanceof Set
    ? blockedPetIds
    : new Set((blockedPetIds ?? []).map(String));
  if (!blocked.size) {
    return false;
  }
  for (const id of petIds ?? []) {
    if (id && blocked.has(String(id))) {
      return true;
    }
  }
  return false;
}

/**
 * @param {Array<{ id?: string }>} pets
 * @param {Set<string>|string[]} blockedPetIds
 */
export function filterPetsNotBlocked(pets = [], blockedPetIds) {
  const blocked = blockedPetIds instanceof Set
    ? blockedPetIds
    : new Set((blockedPetIds ?? []).map(String));
  if (!blocked.size) {
    return [...pets];
  }
  return pets.filter((pet) => pet?.id && !blocked.has(String(pet.id)));
}
