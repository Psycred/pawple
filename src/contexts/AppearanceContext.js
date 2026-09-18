import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { APPEARANCE_STORAGE_KEY, applyThemeColorMode } from '../config/theme';
import { resolveAppearanceColorMode } from '../lib/appearancePreference';

const AppearanceContext = createContext(null);

const VALID_PREFERENCES = new Set(['System', 'Light', 'Dark']);

export function AppearanceProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState('System');
  const [hydrated, setHydrated] = useState(false);

  const colorMode = useMemo(
    () => resolveAppearanceColorMode(preference, systemScheme),
    [preference, systemScheme],
  );

  useEffect(() => {
    applyThemeColorMode(colorMode);
  }, [colorMode]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
        if (!cancelled && stored && VALID_PREFERENCES.has(stored)) {
          setPreference(stored);
        }
      } catch (error) {
        console.log('[Appearance] hydrate error', error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAppearancePreference = useCallback(async (next) => {
    if (!VALID_PREFERENCES.has(next)) {
      return;
    }
    setPreference(next);
    try {
      await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch (error) {
      console.log('[Appearance] persist error', error);
    }
  }, []);

  const value = useMemo(
    () => ({
      preference,
      colorMode,
      isDark: colorMode === 'dark',
      hydrated,
      setAppearancePreference,
    }),
    [colorMode, hydrated, preference, setAppearancePreference],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return context;
}
