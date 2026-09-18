const test = require('node:test');
const assert = require('node:assert/strict');

// diagnosticLog reads __DEV__ and env at import time — test the parser logic inline.
function parseDiagnosticNamespaces(raw) {
  const value = String(raw ?? 'camera').trim().toLowerCase();
  if (!value || value === 'off' || value === 'false' || value === '0') {
    return new Set();
  }
  if (value === 'all' || value === 'true' || value === '1') {
    return new Set(['all']);
  }
  return new Set(
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function isNamespaceEnabled(enabled, namespace) {
  if (enabled.has('all')) {
    return true;
  }
  return enabled.has(namespace);
}

test('diagnostics default to camera namespace', () => {
  const enabled = parseDiagnosticNamespaces(undefined);
  assert.equal(isNamespaceEnabled(enabled, 'camera'), true);
  assert.equal(isNamespaceEnabled(enabled, 'auth'), false);
});

test('diagnostics all enables every namespace', () => {
  const enabled = parseDiagnosticNamespaces('all');
  assert.equal(isNamespaceEnabled(enabled, 'camera'), true);
  assert.equal(isNamespaceEnabled(enabled, 'navigation'), true);
});

test('diagnostics off disables logging', () => {
  const enabled = parseDiagnosticNamespaces('off');
  assert.equal(enabled.size, 0);
});
