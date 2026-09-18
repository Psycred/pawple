/**
 * ML Kit hooks require stable config objects — inline `{}` causes infinite reload loops.
 * Run: node --test tests/unit/usePhotoValidation.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('usePhotoValidation ML config stability', () => {
  const source = readSrc('src/validation/usePhotoValidation.js');

  it('uses module-level object detection config instead of inline assets object', () => {
    assert.match(source, /OBJECT_DETECTION_MODEL_CONFIG/);
    assert.match(source, /useObjectDetectionModels\(OBJECT_DETECTION_MODEL_CONFIG\)/);
    assert.doesNotMatch(source, /useObjectDetectionModels\(\{\s*assets:\s*\{\}/);
  });
});
