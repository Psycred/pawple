import { useMemo } from 'react';
import { getResolvedThemeSurfaces } from '../config/theme';
import { useAppearance } from '../contexts/AppearanceContext';

/**
 * Reads semantic surface/text colors for the active appearance mode.
 * Use for inline style overrides where module-level StyleSheet colors are static.
 */
export function useRuntimeThemeColors() {
  const { colorMode, isDark } = useAppearance();

  const surfaces = useMemo(() => getResolvedThemeSurfaces(colorMode), [colorMode]);

  return useMemo(
    () => ({
      ...surfaces,
      isDark,
      statusBarStyle: isDark ? 'light-content' : 'dark-content',
    }),
    [isDark, surfaces],
  );
}
