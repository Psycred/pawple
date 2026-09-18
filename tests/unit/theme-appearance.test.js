/**
 * Dark theme + appearance preference — unit tests.
 * Run: node --test tests/unit/theme-appearance.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  APPEARANCE_STORAGE_KEY,
  applyThemeColorMode,
  getResolvedThemeSurfaces,
  theme,
} from '../../src/config/theme.js';
import { resolveAppearanceColorMode } from '../../src/lib/appearancePreference.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('theme appearance surfaces', () => {
  it('keeps the light palette unchanged', () => {
    const light = getResolvedThemeSurfaces('light');
    assert.equal(light.backgroundScreen, '#F5F4F1');
    assert.equal(light.backgroundCard, '#FBFAF8');
    assert.equal(light.textPrimary, '#2F2F2F');
    assert.equal(light.textSecondary, '#6A6A6A');
    assert.equal(light.textMuted, '#7A7A7A');
  });

  it('uses the restrained dark palette', () => {
    const dark = getResolvedThemeSurfaces('dark');
    assert.equal(dark.backgroundScreen, '#111111');
    assert.equal(dark.backgroundCard, '#1C1C1C');
    assert.equal(dark.backgroundElevated, '#242424');
    assert.equal(dark.border, '#303030');
    assert.equal(dark.textPrimary, '#F5F1E8');
    assert.equal(dark.textSecondary, '#C8C4BC');
    assert.equal(dark.textMuted, '#918D86');
  });

  it('restores light runtime aliases after switching back from dark', () => {
    applyThemeColorMode('dark');
    assert.equal(theme.colors.background.screen, '#111111');
    assert.equal(theme.colors.text.primary.light, '#F5F1E8');

    applyThemeColorMode('light');
    assert.equal(theme.colors.background.screen, '#F5F4F1');
    assert.equal(theme.colors.background.card, '#FBFAF8');
    assert.equal(theme.colors.text.primary.light, '#2F2F2F');
    assert.equal(theme.colors.text.secondary.light, '#6A6A6A');
  });
});

describe('appearance preference resolution', () => {
  it('uses System, Light, and Dark labels in Settings', () => {
    const settings = readSrc('src/screens/SettingsScreen.js');
    assert.match(settings, /const options = \['System', 'Light', 'Dark'\]/);
    assert.match(settings, /useAppearance/);
    assert.match(settings, /setAppearancePreference/);
  });

  it('persists to the existing settings.appearance key', () => {
    assert.equal(APPEARANCE_STORAGE_KEY, 'settings.appearance');
    const context = readSrc('src/contexts/AppearanceContext.js');
    assert.match(context, /APPEARANCE_STORAGE_KEY/);
    assert.match(context, /resolveAppearanceColorMode/);
  });

  it('resolves System from the device color scheme', () => {
    assert.equal(resolveAppearanceColorMode('System', 'dark'), 'dark');
    assert.equal(resolveAppearanceColorMode('System', 'light'), 'light');
    assert.equal(resolveAppearanceColorMode('Light', 'dark'), 'light');
    assert.equal(resolveAppearanceColorMode('Dark', 'light'), 'dark');
  });
});

describe('appearance wiring', () => {
  it('wraps the app in AppearanceProvider', () => {
    const app = readSrc('App.js');
    assert.match(app, /AppearanceProvider/);
    assert.match(app, /useAppearance/);
    assert.match(app, /theme={navigationTheme}/);
  });
});
