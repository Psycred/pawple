const TYPE_LABEL = {
  dog: 'Dog',
  cat: 'Cat',
  fish: 'Fish',
};

/**
 * Human-readable type segment for lists / feed (e.g. "Bruno • Dog • Labrador").
 * Supports Supabase rows with `pet_type` + optional `pet_type_custom`.
 */
export function getPetTypeDisplayLabel(pet) {
  const t = pet?.pet_type;
  if (t === 'dog' || t === 'cat' || t === 'fish') {
    return TYPE_LABEL[t];
  }
  if (t === 'other') {
    const custom = typeof pet?.pet_type_custom === 'string' ? pet.pet_type_custom.trim() : '';
    return custom || 'Other';
  }
  return '';
}

/** One line: Name • Type • Breed (type is enum label or custom for other). */
export function formatPetIdentityLine(pet) {
  const name = (pet?.name ?? '').trim() || 'Unnamed';
  const typePart = getPetTypeDisplayLabel(pet) || '…';
  const breed = (pet?.breed ?? '').trim() || '…';
  return `${name} • ${typePart} • ${breed}`;
}
