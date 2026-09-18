/** Reject when the Marqo NSFW score meets or exceeds this value. */
const NSFW_CONFIDENCE_THRESHOLD = 0.5;

/** Minimum ImageNet animal-class score for a localized object crop. */
const OBJECT_ANIMAL_CONFIDENCE_THRESHOLD = 0.35;

/** Minimum fraction of image area a localized animal box must cover to qualify alone. */
const OBJECT_ANIMAL_MIN_AREA_RATIO = 0.03;

/**
 * Stricter whole-image fallback when the localizer does not yield an animal.
 * Helps held / small-animal recall without using box-area ratios.
 */
const SCENE_ANIMAL_CONFIDENCE_THRESHOLD = 0.42;

/**
 * Localized objects are treated as salient by ML Kit. If the default
 * detector also returns label confidences, require at least this value.
 * Empty label lists (classification disabled) count as fully salient.
 */
const OBJECT_SALIENCE_THRESHOLD = 0.1;

module.exports = {
  NSFW_CONFIDENCE_THRESHOLD,
  OBJECT_ANIMAL_CONFIDENCE_THRESHOLD,
  OBJECT_ANIMAL_MIN_AREA_RATIO,
  SCENE_ANIMAL_CONFIDENCE_THRESHOLD,
  OBJECT_SALIENCE_THRESHOLD,
};
