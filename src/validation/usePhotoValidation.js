import { useCallback, useMemo } from 'react';
import {
  useImageLabeling,
  useImageLabelingModels,
  useImageLabelingProvider,
} from '@infinitered/react-native-mlkit-image-labeling';
import {
  useObjectDetection,
  useObjectDetectionModels,
  useObjectDetectionProvider,
} from '@infinitered/react-native-mlkit-object-detection';
import {
  DEFAULT_OBJECT_DETECTOR_OPTIONS,
  IMAGE_LABELING_MODELS,
  NSFW_MODEL_NAME,
  OBJECT_DETECTOR_NAME,
  ANIMAL_MODEL_NAME,
} from './models';
import { createPhotoValidator } from './validatePhoto';
import { cropObjectImage, getImageSize } from './cropObjectImage';
import { preprocessMarqoNsfwImage } from './marqoNsfwPreprocess';

/** Stable reference — inline `{}` retriggers ML Kit load effect every render. */
const OBJECT_DETECTION_ASSETS = {};

const OBJECT_DETECTION_MODEL_CONFIG = {
  assets: OBJECT_DETECTION_ASSETS,
  loadDefaultModel: true,
  defaultModelOptions: DEFAULT_OBJECT_DETECTOR_OPTIONS,
};

function isModelReady(model, methodName) {
  if (!model || typeof model[methodName] !== 'function') {
    return false;
  }
  if (typeof model.isLoaded === 'function') {
    return model.isLoaded();
  }
  return true;
}

export function PhotoValidationProviders({ children }) {
  const labelingModels = useImageLabelingModels(IMAGE_LABELING_MODELS);
  const { ImageLabelingModelProvider } = useImageLabelingProvider(labelingModels);
  const objectModels = useObjectDetectionModels(OBJECT_DETECTION_MODEL_CONFIG);
  const { ObjectDetectionProvider } = useObjectDetectionProvider(objectModels);

  return (
    <ImageLabelingModelProvider>
      <ObjectDetectionProvider>{children}</ObjectDetectionProvider>
    </ImageLabelingModelProvider>
  );
}

export function usePhotoValidation() {
  const nsfwClassifier = useImageLabeling(NSFW_MODEL_NAME);
  const animalClassifier = useImageLabeling(ANIMAL_MODEL_NAME);
  const objectDetector = useObjectDetection(OBJECT_DETECTOR_NAME);

  const nsfwReady = isModelReady(nsfwClassifier, 'classifyImage');
  const animalReady = isModelReady(animalClassifier, 'classifyImage');
  const detectorReady = isModelReady(objectDetector, 'detectObjects');
  const ready = nsfwReady && animalReady && detectorReady;

  const validate = useMemo(
    () =>
      createPhotoValidator({
        nsfwClassifier,
        animalClassifier,
        objectDetector,
        cropImage: cropObjectImage,
        getImageSize,
        preprocessMarqoNsfwImage,
      }),
    [nsfwClassifier, animalClassifier, objectDetector],
  );

  const validateSelectedPhoto = useCallback((uri) => validate(uri), [validate]);

  return {
    ready,
    models: {
      nsfw: nsfwReady,
      imageNetAnimals: animalReady,
      objectDetector: detectorReady,
    },
    validatePhoto: validateSelectedPhoto,
  };
}
