const { DETECTION_SOURCE } = require('./reasonCodes');
const { bestAnimal } = require('./animalLabels');
const {
  OBJECT_ANIMAL_CONFIDENCE_THRESHOLD,
  OBJECT_ANIMAL_MIN_AREA_RATIO,
  OBJECT_SALIENCE_THRESHOLD,
  SCENE_ANIMAL_CONFIDENCE_THRESHOLD,
} = require('./thresholds');

function objectSalience(detectedObject) {
  const confidences = (detectedObject?.labels || [])
    .map((label) => Number(label?.confidence))
    .filter((value) => Number.isFinite(value));
  if (confidences.length === 0) {
    return 1;
  }
  return Math.max(...confidences);
}

function cloneFrame(detectedFrame) {
  if (!detectedFrame?.origin || !detectedFrame?.size) {
    return null;
  }
  return {
    origin: { x: Number(detectedFrame.origin.x) || 0, y: Number(detectedFrame.origin.y) || 0 },
    size: { x: Number(detectedFrame.size.x) || 0, y: Number(detectedFrame.size.y) || 0 },
  };
}

function cropKey(detectedFrame) {
  if (!detectedFrame) {
    return 'unknown';
  }
  return [detectedFrame.origin.x, detectedFrame.origin.y, detectedFrame.size.x, detectedFrame.size.y].join(':');
}

function frameAreaRatio(frame, imageSize) {
  if (!frame?.size || !imageSize?.width || !imageSize?.height) {
    return 0;
  }
  const boxArea = Math.max(0, Number(frame.size.x) || 0) * Math.max(0, Number(frame.size.y) || 0);
  const imageArea = Math.max(1, Number(imageSize.width) || 0) * Math.max(1, Number(imageSize.height) || 0);
  return boxArea / imageArea;
}

function isProminentLocalizedAnimal(animalEntry, imageSize, sceneAnimalPasses) {
  if (sceneAnimalPasses) {
    return true;
  }
  return frameAreaRatio(animalEntry.frame, imageSize) >= OBJECT_ANIMAL_MIN_AREA_RATIO;
}

async function classifyAnimalLabels(uri, classifier) {
  if (!classifier || typeof classifier.classifyImage !== 'function') {
    throw new Error('Animal classifier is not available');
  }
  const labels = await classifier.classifyImage(uri);
  return {
    labels: labels || [],
    animal: bestAnimal(labels),
  };
}

async function animalCheck(uri, { objectDetector, animalClassifier, petClassifier, cropImage, getImageSize } = {}) {
  const classifier = animalClassifier || petClassifier;

  if (!uri) {
    throw new Error('Image URI is required for animal detection');
  }
  if (!objectDetector || typeof objectDetector.detectObjects !== 'function') {
    throw new Error('Object detector is not available');
  }

  let imageSize = null;
  if (typeof getImageSize === 'function') {
    try {
      imageSize = await getImageSize(uri);
    } catch {
      imageSize = null;
    }
  }

  const detectedObjects = (await objectDetector.detectObjects(uri)) || [];
  const localizedFrames = detectedObjects.map((object) => cloneFrame(object.frame)).filter(Boolean);
  const objectAnimals = [];

  for (const detectedObject of detectedObjects) {
    const salience = objectSalience(detectedObject);
    if (salience < OBJECT_SALIENCE_THRESHOLD) {
      continue;
    }

    const detectedFrame = cloneFrame(detectedObject.frame);
    let cropUri = uri;
    if (typeof cropImage === 'function') {
      try {
        const cropped = await cropImage(uri, detectedFrame);
        if (!cropped) {
          continue;
        }
        cropUri = cropped;
      } catch {
        continue;
      }
    }

    const { labels, animal } = await classifyAnimalLabels(cropUri, classifier);
    if (!animal || animal.confidence < OBJECT_ANIMAL_CONFIDENCE_THRESHOLD) {
      continue;
    }

    objectAnimals.push({
      ...animal,
      frame: detectedFrame,
      salience,
      source: DETECTION_SOURCE.OBJECT,
      cropKey: cropKey(detectedFrame),
      labels,
    });
  }

  objectAnimals.sort((a, b) => b.confidence - a.confidence);

  const scene = await classifyAnimalLabels(uri, classifier);
  const sceneAnimal =
    scene.animal && scene.animal.confidence >= SCENE_ANIMAL_CONFIDENCE_THRESHOLD
      ? {
          ...scene.animal,
          frame: null,
          salience: null,
          source: DETECTION_SOURCE.SCENE,
          labels: scene.labels,
        }
      : null;
  const sceneAnimalPasses = Boolean(sceneAnimal);

  const prominentObjectAnimals = objectAnimals.filter((animal) =>
    isProminentLocalizedAnimal(animal, imageSize, sceneAnimalPasses),
  );

  if (prominentObjectAnimals.length > 0) {
    return {
      hasAnimal: true,
      source: DETECTION_SOURCE.OBJECT,
      animals: prominentObjectAnimals,
      frames: prominentObjectAnimals.map((animal) => animal.frame).filter(Boolean),
      localizedFrames,
      objectCount: detectedObjects.length,
      thresholds: {
        object: OBJECT_ANIMAL_CONFIDENCE_THRESHOLD,
        scene: SCENE_ANIMAL_CONFIDENCE_THRESHOLD,
        salience: OBJECT_SALIENCE_THRESHOLD,
        minAreaRatio: OBJECT_ANIMAL_MIN_AREA_RATIO,
      },
    };
  }

  return {
    hasAnimal: sceneAnimalPasses,
    source: sceneAnimal ? DETECTION_SOURCE.SCENE : null,
    animals: sceneAnimal ? [sceneAnimal] : [],
    frames: [],
    localizedFrames,
    objectCount: detectedObjects.length,
    thresholds: {
      object: OBJECT_ANIMAL_CONFIDENCE_THRESHOLD,
      scene: SCENE_ANIMAL_CONFIDENCE_THRESHOLD,
      salience: OBJECT_SALIENCE_THRESHOLD,
      minAreaRatio: OBJECT_ANIMAL_MIN_AREA_RATIO,
    },
  };
}

module.exports = {
  classifyAnimalLabels,
  animalCheck,
  frameAreaRatio,
  isProminentLocalizedAnimal,
};
