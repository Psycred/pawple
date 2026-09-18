/**
 * Appearance preference helpers (no React) — shared by Settings, context, and tests.
 */

/**
 * @param {'System'|'Light'|'Dark'} preference
 * @param {'light'|'dark'|null|undefined} systemScheme
 * @returns {'light'|'dark'}
 */
export function resolveAppearanceColorMode(preference, systemScheme) {
  if (preference === 'Dark') {
    return 'dark';
  }
  if (preference === 'Light') {
    return 'light';
  }
  return systemScheme === 'dark' ? 'dark' : 'light';
}
