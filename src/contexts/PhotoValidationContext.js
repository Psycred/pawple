import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PhotoValidationProviders, usePhotoValidation } from '../validation/usePhotoValidation';

const PhotoValidationContext = createContext(null);

const PHOTO_VALIDATION_PREPARE_TIMEOUT_MS = 60_000;

const INACTIVE_MODELS = {
  nsfw: false,
  imageNetAnimals: false,
  objectDetector: false,
};

let registeredValidatePhoto = null;
let registeredReady = false;
let preparePhotoValidationGlobal = null;

export function getRegisteredPhotoValidator() {
  if (!registeredReady || typeof registeredValidatePhoto !== 'function') {
    return null;
  }
  return registeredValidatePhoto;
}

/**
 * Activates on-device photo models (if needed) and waits until they are ready.
 * Safe to call multiple times; no-op when already loaded.
 */
export async function ensurePhotoValidationReady() {
  if (registeredReady && typeof registeredValidatePhoto === 'function') {
    return { ready: true, validatePhoto: registeredValidatePhoto };
  }
  if (typeof preparePhotoValidationGlobal !== 'function') {
    return { ready: false, validatePhoto: null };
  }
  return preparePhotoValidationGlobal();
}

/**
 * Loads ML models in a sibling subtree so activating validation never unmounts
 * onboarding screens or other form state elsewhere in the app.
 */
function PhotoValidationEngine({ onEngineReady }) {
  const { ready, validatePhoto } = usePhotoValidation();
  const readyNotifiedRef = useRef(false);

  useEffect(() => {
    registeredValidatePhoto = validatePhoto;
    registeredReady = ready;

    if (ready && !readyNotifiedRef.current) {
      readyNotifiedRef.current = true;
      onEngineReady?.();
    }

    return () => {
      registeredValidatePhoto = null;
      registeredReady = false;
      readyNotifiedRef.current = false;
    };
  }, [ready, validatePhoto, onEngineReady]);

  return null;
}

export function PhotoValidationProvider({ children }) {
  // Lazy-load ML models on first photo pick — keeps cold start calm on emulators.
  const [engineActive, setEngineActive] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const engineReadyReportedRef = useRef(false);
  const readyWaitersRef = useRef([]);
  const preparePromiseRef = useRef(null);

  const resolveReadyWaiters = useCallback(() => {
    if (!registeredReady || typeof registeredValidatePhoto !== 'function') {
      return;
    }
    const waiters = readyWaitersRef.current.splice(0);
    waiters.forEach((resolve) => {
      resolve({ ready: true, validatePhoto: registeredValidatePhoto });
    });
    preparePromiseRef.current = null;
  }, []);

  const handleEngineReady = useCallback(() => {
    if (!engineReadyReportedRef.current) {
      engineReadyReportedRef.current = true;
      setEngineReady(true);
    }
    resolveReadyWaiters();
  }, [resolveReadyWaiters]);

  const preparePhotoValidation = useCallback(async () => {
    if (registeredReady && typeof registeredValidatePhoto === 'function') {
      return { ready: true, validatePhoto: registeredValidatePhoto };
    }

    if (!engineActive) {
      setEngineActive(true);
    }

    if (!preparePromiseRef.current) {
      preparePromiseRef.current = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const index = readyWaitersRef.current.indexOf(resolve);
          if (index >= 0) {
            readyWaitersRef.current.splice(index, 1);
          }
          preparePromiseRef.current = null;
          reject(new Error('photo_validation_prepare_timeout'));
        }, PHOTO_VALIDATION_PREPARE_TIMEOUT_MS);

        readyWaitersRef.current.push((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        });

        if (registeredReady && typeof registeredValidatePhoto === 'function') {
          clearTimeout(timeoutId);
          preparePromiseRef.current = null;
          resolve({ ready: true, validatePhoto: registeredValidatePhoto });
        }
      });
    }

    return preparePromiseRef.current;
  }, [engineActive]);

  useEffect(() => {
    preparePhotoValidationGlobal = preparePhotoValidation;
    return () => {
      preparePhotoValidationGlobal = null;
    };
  }, [preparePhotoValidation]);

  const contextValue = useMemo(() => {
    const validator = engineReady ? getRegisteredPhotoValidator() : null;
    return {
      ready: Boolean(validator),
      validatePhoto: validator,
      models: INACTIVE_MODELS,
      preparePhotoValidation,
    };
  }, [engineReady, preparePhotoValidation]);

  return (
    <>
      {engineActive ? (
        <PhotoValidationProviders>
          <PhotoValidationEngine onEngineReady={handleEngineReady} />
        </PhotoValidationProviders>
      ) : null}
      <PhotoValidationContext.Provider value={contextValue}>{children}</PhotoValidationContext.Provider>
    </>
  );
}

export function usePhotoValidationGate() {
  const context = useContext(PhotoValidationContext);
  if (!context) {
    throw new Error('usePhotoValidationGate must be used within PhotoValidationProvider');
  }
  return context;
}
