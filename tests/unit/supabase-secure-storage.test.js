import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('supabase secure auth storage', () => {
  it('wires SecureStore-backed storage into the Supabase client', () => {
    const source = readFileSync(join(root, 'src/config/supabase.js'), 'utf8');
    assert.match(source, /supabaseSecureStorage/);
    assert.doesNotMatch(source, /storage:\s*AsyncStorage/);
  });

  it('clears signed media cache on logout', () => {
    const source = readFileSync(join(root, 'src/lib/authSession.js'), 'utf8');
    assert.match(source, /clearSignedUrlCache/);
  });
});
