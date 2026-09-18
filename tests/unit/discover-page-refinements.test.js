import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Discover page refinements — Task 12', () => {
  const discovery = readSrc('src/screens/MatingDiscoveryScreen.js');

  it('skips full-page loading when preserving existing results on refresh', () => {
    assert.match(discovery, /preserveResults/);
    assert.match(discovery, /if \(!preserveResults\)/);
    assert.match(discovery, /setLoading\(true\)/);
    assert.match(discovery, /resultsPetIdRef/);
  });

  it('keeps stale results visible when a background refresh fails', () => {
    const catchBlock = discovery.slice(
      discovery.indexOf('} catch (e) {'),
      discovery.indexOf('} finally {', discovery.indexOf('} catch (e) {')),
    );
    assert.match(catchBlock, /if \(!preserveResults\)/);
    assert.match(catchBlock, /setError\(true\)/);
    assert.match(catchBlock, /setOpportunities\(\[\]\)/);
  });

  it('does not reset paw state to unknown before background paw refresh', () => {
    assert.doesNotMatch(discovery, /ready: false \}\)\);[\s\S]*await refreshPawState/);
    assert.match(discovery, /preserveKnownOnFailure/);
    assert.match(discovery, /preserveKnownOnFailure: preserveResults/);
  });

  it('preserves known paw state when background paw lookup fails', () => {
    assert.match(discovery, /if \(preserveKnownOnFailure && prev\.ready\)/);
  });

  it('applies calm top breathing room on Discover content padding', () => {
    assert.match(discovery, /scrollPad:[\s\S]*paddingTop: 8/);
    assert.match(discovery, /listContent:[\s\S]*paddingTop: 8/);
  });

  it('uses PawpleEmptyState for pet-not-found', () => {
    assert.match(discovery, /title="Pet not found"/);
    assert.match(discovery, /PawpleEmptyState/);
    assert.doesNotMatch(discovery, /emptyTitle/);
  });

  it('does not add pull-to-refresh', () => {
    assert.doesNotMatch(discovery, /RefreshControl/);
    assert.doesNotMatch(discovery, /onRefresh/);
  });

  it('keeps defensive not-opted-in empty state without new mating CTA', () => {
    assert.match(discovery, /Open to Mating to discover/);
    assert.doesNotMatch(discovery, /Enable Mating/i);
    assert.doesNotMatch(discovery, /is_looking_for_companion.*navigation\.navigate/);
  });
});
