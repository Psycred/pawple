/** Suggested personality traits for pet profiles. */
export const TRAIT_SUGGESTIONS = [
  'Friendly',
  'Playful',
  'Calm',
  'Shy',
  'Curious',
  'Loves Water',
  'Loves Walks',
  'Good with Kids',
  'Good with Dogs',
  'Good with Cats',
  'Cuddly',
  'Independent',
];

/** Maximum traits a pet profile can display. */
export const MAX_TRAITS = 5;

export function normalizeTraits(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((trait) => typeof trait === 'string' && trait.trim())
    .map((trait) => trait.trim());
}
