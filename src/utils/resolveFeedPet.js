/** Split stored pet_names ("Bruno, Luna") into display names. */
export function parsePetNamesLine(petNames) {
  return String(petNames ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Match a display name to a pet row from the current user's pets list. */
export function resolvePetIdByName(name, pets = []) {
  const needle = String(name ?? '').trim().toLowerCase();
  if (!needle) {
    return null;
  }
  const match = pets.find((p) => String(p?.name ?? '').trim().toLowerCase() === needle);
  return match?.id != null ? String(match.id) : null;
}

/** Build { name, petId } entries for feed cards. */
export function buildPetEntries(petNames, pets = []) {
  return parsePetNamesLine(petNames).map((name) => ({
    name,
    petId: resolvePetIdByName(name, pets),
  }));
}
