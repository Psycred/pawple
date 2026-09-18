const { nsfwCheck } = require('./nsfwCheck');
const { animalCheck } = require('./animalCheck');
const { REASON, STAGE_STATUS } = require('./reasonCodes');

function emptyAnimalResult() {
  return {
    hasAnimal: false,
    source: null,
    animals: [],
    frames: [],
    localizedFrames: [],
    objectCount: 0,
  };
}

/** Temporary dev-only NSFW investigation logs — filter logcat with PawpleDiag:nsfw */
function logValidatePhotoNsfwOutcome(payload) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }
  console.log('[PawpleDiag:nsfw]', JSON.stringify(payload, null, 2));
}

function failClosed({ reason, error, nsfw, animal, stages }) {
  return {
    accepted: false,
    reason,
    nsfw: nsfw || {
      isNsfw: null,
      nsfwConfidence: null,
      sfwConfidence: null,
    },
    animal: animal || emptyAnimalResult(),
    stages,
    error: {
      code: reason,
      message: error instanceof Error ? error.message : String(error || reason),
    },
  };
}

async function validatePhoto(uri, deps = {}) {
  const animalClassifier = deps.animalClassifier || deps.petClassifier;

  if (!uri) {
    return failClosed({
      reason: REASON.INVALID_IMAGE,
      error: 'An image URI is required',
      stages: {
        nsfw: STAGE_STATUS.ERROR,
        animal: STAGE_STATUS.SKIPPED,
      },
    });
  }

  if (!deps.nsfwClassifier || typeof deps.nsfwClassifier.classifyImage !== 'function') {
    return failClosed({
      reason: REASON.MODELS_NOT_READY,
      error: 'NSFW classifier is not ready',
      stages: {
        nsfw: STAGE_STATUS.ERROR,
        animal: STAGE_STATUS.SKIPPED,
      },
    });
  }

  const animalModelsReady =
    animalClassifier &&
    typeof animalClassifier.classifyImage === 'function' &&
    deps.objectDetector &&
    typeof deps.objectDetector.detectObjects === 'function';

  if (!animalModelsReady) {
    return failClosed({
      reason: REASON.MODELS_NOT_READY,
      error: 'Animal detection models are not ready',
      stages: {
        nsfw: STAGE_STATUS.SKIPPED,
        animal: STAGE_STATUS.ERROR,
      },
    });
  }

  let nsfw;
  let animal;

  try {
    [nsfw, animal] = await Promise.all([
      nsfwCheck(uri, deps.nsfwClassifier, deps),
      animalCheck(uri, { ...deps, animalClassifier }),
    ]);
  } catch (error) {
    const reason =
      error?.message?.includes('NSFW') || error?.message?.includes('classifier')
        ? REASON.NSFW_CHECK_FAILED
        : REASON.ANIMAL_CHECK_FAILED;
    logValidatePhotoNsfwOutcome({
      event: 'photo_validation_final',
      source: 'validatePhoto',
      input: { imageUri: uri },
      appFinalDecision: {
        note: 'validatePhoto outcome after NSFW/animal checks',
        accepted: false,
        reason,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    return failClosed({
      reason,
      error,
      stages: {
        nsfw: reason === REASON.NSFW_CHECK_FAILED ? STAGE_STATUS.ERROR : STAGE_STATUS.PASSED,
        animal: reason === REASON.ANIMAL_CHECK_FAILED ? STAGE_STATUS.ERROR : STAGE_STATUS.PASSED,
      },
    });
  }

  // NSFW is evaluated first — animal detection cannot override unsafe content.
  if (nsfw.isNsfw) {
    const result = {
      accepted: false,
      reason: REASON.NSFW_DETECTED,
      nsfw,
      animal,
      stages: {
        nsfw: STAGE_STATUS.FAILED,
        animal: animal.hasAnimal ? STAGE_STATUS.PASSED : STAGE_STATUS.FAILED,
      },
      error: null,
    };
    logValidatePhotoNsfwOutcome({
      event: 'photo_validation_final',
      source: 'validatePhoto',
      input: { imageUri: uri },
      appFinalDecision: {
        note: 'validatePhoto outcome — NSFW gate rejected before animal outcome matters',
        accepted: result.accepted,
        reason: result.reason,
        nsfwStage: result.stages.nsfw,
        animalStage: result.stages.animal,
        animalWouldHavePassed: Boolean(animal.hasAnimal),
      },
      nsfwCheckResult: nsfw,
    });
    return result;
  }

  if (animal.hasAnimal) {
    const result = {
      accepted: true,
      reason: REASON.ANIMAL_DETECTED,
      nsfw,
      animal,
      stages: {
        nsfw: STAGE_STATUS.PASSED,
        animal: STAGE_STATUS.PASSED,
      },
      error: null,
    };
    logValidatePhotoNsfwOutcome({
      event: 'photo_validation_final',
      source: 'validatePhoto',
      input: { imageUri: uri },
      appFinalDecision: {
        note: 'validatePhoto outcome — NSFW gate passed; photo accepted',
        accepted: result.accepted,
        reason: result.reason,
        nsfwStage: result.stages.nsfw,
        animalStage: result.stages.animal,
      },
      nsfwCheckResult: nsfw,
    });
    return result;
  }

  const result = {
    accepted: false,
    reason: REASON.NO_ANIMAL,
    nsfw,
    animal,
    stages: {
      nsfw: STAGE_STATUS.PASSED,
      animal: STAGE_STATUS.FAILED,
    },
    error: null,
  };
  logValidatePhotoNsfwOutcome({
    event: 'photo_validation_final',
    source: 'validatePhoto',
    input: { imageUri: uri },
    appFinalDecision: {
      note: 'validatePhoto outcome — NSFW gate passed; rejected for no animal',
      accepted: result.accepted,
      reason: result.reason,
      nsfwStage: result.stages.nsfw,
      animalStage: result.stages.animal,
    },
    nsfwCheckResult: nsfw,
  });
  return result;
}

function createPhotoValidator(deps) {
  return function validatePhotoForUri(uri) {
    return validatePhoto(uri, deps);
  };
}

module.exports = {
  validatePhoto,
  createPhotoValidator,
};
