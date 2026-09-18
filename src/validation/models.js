const NSFW_MODEL_MODULE = require('../../assets/ml/marqo_nsfw.tflite');
const MOBILENET_MODEL_MODULE = require('../../assets/ml/mobilenet_v1_1.0_224_quantized_1_metadata_1.tflite');

const NSFW_MODEL_NAME = 'nsfw';
const ANIMAL_MODEL_NAME = 'imageNetAnimals';
const OBJECT_DETECTOR_NAME = 'default';

const IMAGE_LABELING_MODELS = {
  [NSFW_MODEL_NAME]: {
    model: NSFW_MODEL_MODULE,
    options: {
      maxResultCount: 5,
      confidenceThreshold: 0.01,
    },
  },
  [ANIMAL_MODEL_NAME]: {
    model: MOBILENET_MODEL_MODULE,
    options: {
      maxResultCount: 10,
      confidenceThreshold: 0.05,
    },
  },
};

const DEFAULT_OBJECT_DETECTOR_OPTIONS = {
  shouldEnableMultipleObjects: true,
  shouldEnableClassification: false,
  detectorMode: 'singleImage',
};

module.exports = {
  NSFW_MODEL_MODULE,
  MOBILENET_MODEL_MODULE,
  NSFW_MODEL_NAME,
  ANIMAL_MODEL_NAME,
  OBJECT_DETECTOR_NAME,
  IMAGE_LABELING_MODELS,
  DEFAULT_OBJECT_DETECTOR_OPTIONS,
};
