const { NSFW_CONFIDENCE_THRESHOLD } = require('./thresholds');

/** Temporary dev-only NSFW investigation logs — filter logcat with PawpleDiag:nsfw */
function logNsfwDiagnostic(payload) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }
  console.log('[PawpleDiag:nsfw]', JSON.stringify(payload, null, 2));
}

function cloneRawClassifierLabels(labels) {
  if (!Array.isArray(labels)) {
    return labels;
  }
  return labels.map((item) => {
    if (item == null || typeof item !== 'object') {
      return item;
    }
    return { ...item };
  });
}

async function resolveDiagnosticImageDimensions(uri, getImageSize) {
  if (typeof getImageSize !== 'function') {
    return { available: false, reason: 'getImageSize_not_provided' };
  }
  try {
    const size = await getImageSize(uri);
    return {
      available: true,
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  } catch (error) {
    return {
      available: false,
      reason: 'getImageSize_failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function asConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeNsfwLabels(labels) {
  let nsfwConfidence = 0;
  let sfwConfidence = 0;
  const normalized = [];

  for (const item of labels || []) {
    const text = String(item?.text || '').trim();
    const confidence = asConfidence(item?.confidence);
    const key = text.toUpperCase();
    normalized.push({ text, confidence, index: item?.index });
    if (key === 'NSFW') {
      nsfwConfidence = confidence;
    } else if (key === 'SFW') {
      sfwConfidence = confidence;
    }
  }

  return { nsfwConfidence, sfwConfidence, labels: normalized };
}

async function nsfwCheck(uri, classifier, diagnosticDeps = {}) {
  if (!uri) {
    throw new Error('Image URI is required for NSFW classification');
  }
  if (!classifier || typeof classifier.classifyImage !== 'function') {
    throw new Error('NSFW classifier is not available');
  }

  const preprocess =
    typeof diagnosticDeps.preprocessMarqoNsfwImage === 'function'
      ? diagnosticDeps.preprocessMarqoNsfwImage
      : async (imageUri, options) => {
          const { preprocessMarqoNsfwImage } = require('./marqoNsfwPreprocess');
          return preprocessMarqoNsfwImage(imageUri, options);
        };

  const preprocessed = await preprocess(uri, { getImageSize: diagnosticDeps.getImageSize });
  const inferenceUri = preprocessed?.uri || preprocessed;

  const classifyPromise = classifier.classifyImage(inferenceUri);
  const dimensionsPromise =
    typeof __DEV__ !== 'undefined' && __DEV__
      ? Promise.all([
          resolveDiagnosticImageDimensions(uri, diagnosticDeps.getImageSize),
          resolveDiagnosticImageDimensions(inferenceUri, diagnosticDeps.getImageSize),
        ]).then(([sourceDimensions, inferenceDimensions]) => ({
          source: sourceDimensions,
          inference: inferenceDimensions,
          preprocessing: preprocessed?.preprocessing || null,
        }))
      : Promise.resolve(null);
  const [rawLabels, imageDimensions] = await Promise.all([classifyPromise, dimensionsPromise]);

  const { nsfwConfidence, sfwConfidence, labels: normalized } = normalizeNsfwLabels(rawLabels);
  const isNsfw = nsfwConfidence >= NSFW_CONFIDENCE_THRESHOLD;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    logNsfwDiagnostic({
      event: 'nsfw_validation_attempt',
      source: 'nsfwCheck',
      input: { imageUri: uri, inferenceUri },
      imageDimensions,
      marqoModelOutput: {
        note: 'Raw classifyImage() labels from Marqo NSFW model — not parsed by Pawple',
        labels: cloneRawClassifierLabels(rawLabels),
      },
      appParserOutput: {
        note: 'normalizeNsfwLabels() — Pawple reads NSFW/SFW label text only',
        normalizedLabels: normalized,
        nsfwConfidence,
        sfwConfidence,
        threshold: NSFW_CONFIDENCE_THRESHOLD,
      },
      appNsfwGateDecision: {
        note: 'nsfwCheck gate — animal validation runs separately in validatePhoto',
        isNsfw,
        decision: isNsfw ? 'reject_nsfw' : 'pass_nsfw_gate',
        rule: `nsfwConfidence (${nsfwConfidence}) >= threshold (${NSFW_CONFIDENCE_THRESHOLD})`,
      },
    });
  }

  if (nsfwConfidence === 0 && sfwConfidence === 0) {
    throw new Error('NSFW classifier returned no NSFW/SFW confidences');
  }

  return {
    isNsfw,
    nsfwConfidence,
    sfwConfidence,
    threshold: NSFW_CONFIDENCE_THRESHOLD,
    labels: normalized,
  };
}

module.exports = {
  normalizeNsfwLabels,
  nsfwCheck,
};
