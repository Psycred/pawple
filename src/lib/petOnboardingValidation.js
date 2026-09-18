export const hasValidBreed = (breed) => !!String(breed ?? '').trim();

/** Ready to save: name + type (+ custom if Other). Breed required only during onboarding. */
export const isPetValid = (pet, { requireBreed = false } = {}) => {
  const typeOk =
    pet.pet_type === 'dog' ||
    pet.pet_type === 'cat' ||
    pet.pet_type === 'fish' ||
    (pet.pet_type === 'other' && !!pet.pet_type_custom?.trim());
  const breedOk = !requireBreed || hasValidBreed(pet.breed);
  return typeOk && !!pet.name.trim() && breedOk;
};

export const getPetFieldErrors = (pet, { requireBreed = false } = {}) => {
  const errors = {};
  const validType = ['dog', 'cat', 'fish', 'other'].includes(pet.pet_type);
  if (!pet.name.trim()) {
    errors.name = 'Please enter a pet name.';
  }
  if (!validType) {
    errors.pet_type = 'Please choose a pet type.';
  }
  if (pet.pet_type === 'other' && !pet.pet_type_custom?.trim()) {
    errors.pet_type_custom = 'Tell us what kind of pet this is.';
  }
  if (requireBreed && !hasValidBreed(pet.breed)) {
    errors.breed = 'Please enter a breed.';
  }
  return errors;
};
