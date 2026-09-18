/**
 * ImageNet-1K animal classes occupy indices 0–397. Index 398 onward are objects,
 * scenes, and people. Pawple only needs to know that some animal is present.
 */
const IMAGENET_ANIMAL_MAX_INDEX = 397;

function normalizeLabel(text) {
  return String(text || '')
    .split(',')[0]
    .trim();
}

function isImageNetAnimalIndex(index) {
  const value = Number(index);
  return Number.isInteger(value) && value >= 0 && value <= IMAGENET_ANIMAL_MAX_INDEX;
}

function findAnimals(labels) {
  const animals = [];
  for (const item of labels || []) {
    const index = Number(item.index);
    if (!isImageNetAnimalIndex(index)) {
      continue;
    }
    animals.push({
      label: normalizeLabel(item.text),
      confidence: Number(item.confidence) || 0,
      index,
      group: 'animal',
    });
  }
  animals.sort((a, b) => b.confidence - a.confidence);
  return animals;
}

function bestAnimal(labels) {
  return findAnimals(labels)[0] || null;
}

module.exports = {
  IMAGENET_ANIMAL_MAX_INDEX,
  normalizeLabel,
  isImageNetAnimalIndex,
  findAnimals,
  bestAnimal,
};
