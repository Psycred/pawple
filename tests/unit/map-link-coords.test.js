import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isAllowedMapLinkHost,
  parseMapLinkCoords,
} from '../../src/lib/mapLinkCoords.js';
import { validateOptionalGoogleMapsLink } from '../../src/utils/mapLinkValidation.js';

describe('parseMapLinkCoords', () => {
  it('parses Google @ lat,lng URLs', () => {
    const coords = parseMapLinkCoords(
      'https://www.google.com/maps/@19.0760,72.8777,15z',
    );
    assert.deepEqual(coords, { lat: 19.076, lng: 72.8777 });
  });

  it('parses Apple ll= coordinates', () => {
    const coords = parseMapLinkCoords(
      'https://maps.apple.com/?ll=28.6139,77.2090',
    );
    assert.deepEqual(coords, { lat: 28.6139, lng: 77.209 });
  });

  it('parses Google !3d!4d coordinate pairs', () => {
    const coords = parseMapLinkCoords(
      'https://www.google.com/maps/place/Test/data=!3d12.9716!4d77.5946',
    );
    assert.deepEqual(coords, { lat: 12.9716, lng: 77.5946 });
  });
});

describe('validateOptionalGoogleMapsLink', () => {
  it('accepts Google and Apple map links', () => {
    assert.equal(
      validateOptionalGoogleMapsLink('https://maps.app.goo.gl/abc').isValid,
      true,
    );
    assert.equal(
      validateOptionalGoogleMapsLink('https://maps.apple.com/?q=Mumbai').isValid,
      true,
    );
  });

  it('rejects non-map URLs', () => {
    const result = validateOptionalGoogleMapsLink('https://example.com/maps');
    assert.equal(result.isValid, false);
  });
});

describe('isAllowedMapLinkHost', () => {
  it('allows known map hosts only', () => {
    assert.equal(isAllowedMapLinkHost('https://maps.app.goo.gl/abc'), true);
    assert.equal(isAllowedMapLinkHost('https://maps.apple.com/?ll=1,2'), true);
    assert.equal(isAllowedMapLinkHost('https://evil.com/maps'), false);
  });
});
