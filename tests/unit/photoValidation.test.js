const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizeNsfwLabels } = require('../../src/validation/nsfwCheck');
const { animalCheck, frameAreaRatio } = require('../../src/validation/animalCheck');
const { validatePhoto } = require('../../src/validation/validatePhoto');
const { OBJECT_ANIMAL_MIN_AREA_RATIO } = require('../../src/validation/thresholds');
const {
  IMAGENET_ANIMAL_MAX_INDEX,
  isImageNetAnimalIndex,
} = require('../../src/validation/animalLabels');
const { REASON, STAGE_STATUS } = require('../../src/validation/reasonCodes');
const { clampCropRect } = require('../../src/validation/cropRect');

function labels(...items) {
  return items.map(([text, confidence, imagenetIndex]) => ({
    text,
    confidence,
    index: imagenetIndex,
  }));
}

function objectFrame(originX, originY, width, height) {
  return {
    frame: { origin: { x: originX, y: originY }, size: { x: width, y: height } },
    labels: [],
  };
}

function cropUriFor(detected) {
  return `crop:${detected.frame.origin.x}:${detected.frame.origin.y}:${detected.frame.size.x}x${detected.frame.size.y}`;
}

function createClassifier(responses) {
  const calls = [];
  return {
    calls,
    async classifyImage(uri) {
      calls.push(uri);
      if (typeof responses === 'function') {
        return responses(uri);
      }
      if (Array.isArray(responses)) {
        return responses;
      }
      return responses[uri] || [];
    },
  };
}

function createDetector(objects) {
  const calls = [];
  return {
    calls,
    async detectObjects(uri) {
      calls.push(uri);
      return objects;
    },
  };
}

async function cropImage(_uri, detectedFrame) {
  return `crop:${detectedFrame.origin.x}:${detectedFrame.origin.y}:${detectedFrame.size.x}x${detectedFrame.size.y}`;
}

function getImageSize(width = 1000, height = 1000) {
  return async () => ({ width, height });
}

/** Unit tests avoid native image manipulation — NSFW preprocess is a pass-through. */
async function passThroughMarqoPreprocess(uri) {
  return { uri, width: null, height: null, preprocessing: { testPassThrough: true } };
}

function runValidatePhoto(uri, deps) {
  return validatePhoto(uri, {
    preprocessMarqoNsfwImage: passThroughMarqoPreprocess,
    ...deps,
  });
}

function sfwLabels() {
  return labels(['SFW', 0.97, 1], ['NSFW', 0.04, 0]);
}

test('ImageNet animal indices span 0 through 397 and exclude objects/people', () => {
  assert.equal(IMAGENET_ANIMAL_MAX_INDEX, 397);
  assert.equal(isImageNetAnimalIndex(291), true);
  assert.equal(isImageNetAnimalIndex(398), false);
  assert.equal(isImageNetAnimalIndex(982), false);
});

test('NSFW without an animal is rejected', async () => {
  const animalClassifier = createClassifier({
    'file://nsfw.jpg': labels(['groom', 0.88, 982]),
  });
  const objectDetector = createDetector([]);

  const result = await runValidatePhoto('file://nsfw.jpg', {
    nsfwClassifier: createClassifier(labels(['NSFW', 0.91, 0], ['SFW', 0.08, 1])),
    animalClassifier,
    objectDetector,
    cropImage,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, REASON.NSFW_DETECTED);
  assert.equal(result.stages.animal, STAGE_STATUS.FAILED);
  assert.equal(animalClassifier.calls.length, 1);
});

test('NSFW unsafe pet photo is rejected even when animal is detected', async () => {
  const result = await runValidatePhoto('file://puppy.jpg', {
    nsfwClassifier: createClassifier(labels(['NSFW', 0.72, 0], ['SFW', 0.28, 1])),
    animalClassifier: createClassifier({
      'file://puppy.jpg': labels(['golden retriever', 0.84, 207]),
    }),
    objectDetector: createDetector([]),
    cropImage,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, REASON.NSFW_DETECTED);
  assert.equal(result.stages.animal, STAGE_STATUS.PASSED);
});

test('NSFW safe pet photo is accepted when animal is detected', async () => {
  const result = await runValidatePhoto('file://puppy.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      'file://puppy.jpg': labels(['golden retriever', 0.84, 207]),
    }),
    objectDetector: createDetector([]),
    cropImage,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, REASON.ANIMAL_DETECTED);
});

test('human-only photo is rejected', async () => {
  const human = objectFrame(12, 16, 640, 800);
  const result = await runValidatePhoto('file://human.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      [cropUriFor(human)]: labels(['groom', 0.88, 982]),
      'file://human.jpg': labels(['ballplayer', 0.81, 981], ['suit', 0.2, 834]),
    }),
    objectDetector: createDetector([human]),
    cropImage,
    getImageSize: getImageSize(1000, 1000),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, REASON.NO_ANIMAL);
});

test('tiny incidental animal without scene support is rejected', async () => {
  const human = objectFrame(0, 0, 1000, 1000);
  const tinyPet = objectFrame(940, 940, 24, 20);
  const animalCheckSource = fs.readFileSync(
    path.join(__dirname, '../../src/validation/animalCheck.js'),
    'utf8',
  );
  assert.match(animalCheckSource, /OBJECT_ANIMAL_MIN_AREA_RATIO/);
  assert.equal(frameAreaRatio(tinyPet.frame, { width: 1000, height: 1000 }) < OBJECT_ANIMAL_MIN_AREA_RATIO, true);

  const result = await runValidatePhoto('file://beach.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      [cropUriFor(human)]: labels(['groom', 0.96, 982]),
      [cropUriFor(tinyPet)]: labels(['golden retriever', 0.64, 207]),
      'file://beach.jpg': labels(['groom', 0.91, 982]),
    }),
    objectDetector: createDetector([human, tinyPet]),
    cropImage,
    getImageSize: getImageSize(1000, 1000),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, REASON.NO_ANIMAL);
});

test('prominent localized animal object is accepted', async () => {
  const pet = objectFrame(100, 100, 500, 500);
  const result = await runValidatePhoto('file://pet.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      [cropUriFor(pet)]: labels(['golden retriever', 0.84, 207]),
      'file://pet.jpg': labels(['groom', 0.2, 982]),
    }),
    objectDetector: createDetector([pet]),
    cropImage,
    getImageSize: getImageSize(1000, 1000),
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, REASON.ANIMAL_DETECTED);
  assert.equal(result.animal.source, 'object');
});

test('small held animal is accepted when scene classification supports it', async () => {
  const tinyPet = objectFrame(900, 900, 30, 30);
  const result = await runValidatePhoto('file://held.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      [cropUriFor(tinyPet)]: labels(['Chihuahua', 0.58, 151]),
      'file://held.jpg': labels(['Chihuahua', 0.45, 151], ['groom', 0.2, 982]),
    }),
    objectDetector: createDetector([tinyPet]),
    cropImage,
    getImageSize: getImageSize(1000, 1000),
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, REASON.ANIMAL_DETECTED);
});

test('human plus meaningful animal is accepted', async () => {
  const human = objectFrame(0, 0, 500, 1000);
  const pet = objectFrame(520, 200, 400, 400);
  const result = await runValidatePhoto('file://owner-pet.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      [cropUriFor(human)]: labels(['groom', 0.92, 982]),
      [cropUriFor(pet)]: labels(['golden retriever', 0.81, 207]),
      'file://owner-pet.jpg': labels(['groom', 0.55, 982], ['golden retriever', 0.3, 207]),
    }),
    objectDetector: createDetector([human, pet]),
    cropImage,
    getImageSize: getImageSize(1000, 1000),
  });

  assert.equal(result.accepted, true);
  assert.equal(result.reason, REASON.ANIMAL_DETECTED);
  assert.equal(result.animal.animals[0].index, 207);
});

test('lion and camel scene photos are accepted', async () => {
  const lion = await runValidatePhoto('file://lion.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      'file://lion.jpg': labels(['lion', 0.84, 291]),
    }),
    objectDetector: createDetector([]),
  });
  assert.equal(lion.accepted, true);

  const camel = await runValidatePhoto('file://camel.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      'file://camel.jpg': labels(['Arabian camel', 0.79, 354]),
    }),
    objectDetector: createDetector([]),
  });
  assert.equal(camel.accepted, true);
});

test('clampCropRect stays inside the image', () => {
  const crop = clampCropRect(
    { origin: { x: 10, y: 10 }, size: { x: 50, y: 40 } },
    { width: 100, height: 80 },
  );
  assert.deepEqual(crop, { originX: 10, originY: 10, width: 50, height: 40 });
});

test('normalizes NSFW/SFW labels regardless of case', () => {
  const result = normalizeNsfwLabels(labels(['nsfw', 0.81, 0], ['sfw', 0.12, 1]));
  assert.equal(result.nsfwConfidence, 0.81);
  assert.equal(result.sfwConfidence, 0.12);
});

test('scene fallback below threshold does not accept', async () => {
  const result = await animalCheck('file://maybe-pet.jpg', {
    objectDetector: createDetector([]),
    animalClassifier: createClassifier({
      'file://maybe-pet.jpg': labels(['golden retriever', 0.35, 207]),
    }),
    getImageSize: getImageSize(1000, 1000),
  });
  assert.equal(result.hasAnimal, false);
});

test('NSFW safe photo without meaningful animal is rejected', async () => {
  const tinyPet = objectFrame(940, 940, 24, 20);
  const result = await runValidatePhoto('file://no-meaningful-animal.jpg', {
    nsfwClassifier: createClassifier(sfwLabels()),
    animalClassifier: createClassifier({
      [cropUriFor(tinyPet)]: labels(['golden retriever', 0.64, 207]),
      'file://no-meaningful-animal.jpg': labels(['groom', 0.88, 982]),
    }),
    objectDetector: createDetector([tinyPet]),
    cropImage,
    getImageSize: getImageSize(1000, 1000),
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, REASON.NO_ANIMAL);
  assert.equal(result.stages.nsfw, STAGE_STATUS.PASSED);
});
