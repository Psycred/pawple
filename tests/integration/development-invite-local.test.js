import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@babel/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const inviteLibPath = path.join(root, 'src', 'lib', 'onboardingInvite.js');
const inviteScreenPath = path.join(root, 'src', 'screens', 'InviteCodeScreen.js');
const removedMigrationPath = path.join(
  root,
  'supabase',
  'migrations',
  '20260829120000_development_invite_bootstrap.sql',
);

const inviteSource = await readFile(inviteLibPath, 'utf8');
const transformedInviteSource = transformSync(inviteSource, {
  filename: inviteLibPath,
  babelrc: false,
  configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;

function loadInviteModule({ isLocalDevRuntime, pawpleEnv }) {
  const calls = [];
  const storage = new Map();
  const asyncStorage = {
    async setItem(key, value) {
      storage.set(key, value);
    },
    async getItem(key) {
      return storage.get(key) ?? null;
    },
    async removeItem(key) {
      storage.delete(key);
    },
  };

  const supabase = {
    from(table) {
      calls.push(table);
      const row =
        table === 'invites'
          ? {
              id: 'real-invite-id',
              user_id: 'inviter-user-id',
              status: 'unused',
            }
          : { id: 'current-user-id' };

      return {
        select() {
          return this;
        },
        update() {
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        async maybeSingle() {
          return { data: row, error: null };
        },
      };
    },
  };

  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === '@react-native-async-storage/async-storage') {
      return asyncStorage;
    }
    if (request === '../config/supabase') {
      return { supabase };
    }
    if (request === '../config/environment') {
      return { isLocalDevRuntime, pawpleEnv };
    }
    throw new Error(`Unexpected test import: ${request}`);
  };

  const wrapper = vm.runInThisContext(
    `(function (require, module, exports) { ${transformedInviteSource}\n})`,
    { filename: inviteLibPath },
  );
  wrapper(localRequire, module, module.exports);
  return { api: module.exports, calls };
}

test('Paw-T00y is accepted locally without a Supabase invite lookup', async () => {
  for (const code of ['Paw-T00y', 'PAW-T00Y', 'paw-t00y', '  Paw-T00y  ']) {
    const { api, calls } = loadInviteModule({
      isLocalDevRuntime: true,
      pawpleEnv: 'development',
    });
    const result = await api.validateInviteCode(code, 'current-user-id');
    assert.deepEqual(
      { ...result },
      { ok: true, inviteId: null, code: 'Paw-T00y' },
    );
    assert.deepEqual(calls, []);
  }
});

test('Paw-T00y is rejected unless both development gates are true', async () => {
  const rejectedEnvironments = [
    { isLocalDevRuntime: false, pawpleEnv: 'development' },
    { isLocalDevRuntime: true, pawpleEnv: 'staging' },
    { isLocalDevRuntime: true, pawpleEnv: 'production' },
    { isLocalDevRuntime: true, pawpleEnv: 'preview' },
  ];

  for (const runtime of rejectedEnvironments) {
    const { api, calls } = loadInviteModule(runtime);
    const result = await api.validateInviteCode(
      'paw-t00y',
      'current-user-id',
    );
    assert.deepEqual({ ...result }, { ok: false, reason: 'invalid' });
    assert.deepEqual(calls, []);
  }
});

test('normal invite codes still use the Supabase invites lookup', async () => {
  const { api, calls } = loadInviteModule({
    isLocalDevRuntime: true,
    pawpleEnv: 'development',
  });
  const result = await api.validateInviteCode(
    '  paw-real  ',
    'current-user-id',
  );

  assert.deepEqual(
    { ...result },
    { ok: true, inviteId: 'real-invite-id', code: 'PAW-REAL' },
  );
  assert.deepEqual(calls, ['invites']);
});

test('development onboarding skips invite consumption but still completes the profile', async () => {
  const { api, calls } = loadInviteModule({
    isLocalDevRuntime: true,
    pawpleEnv: 'development',
  });

  const completedAt = await api.completeOnboarding({
    userId: 'current-user-id',
    inviteId: null,
    inviteCode: ' paw-t00y ',
  });

  assert.ok(Date.parse(completedAt));
  assert.deepEqual(calls, ['profiles']);
});

test('deferred Supabase bootstrap machinery is absent', async () => {
  const inviteScreen = await readFile(inviteScreenPath, 'utf8');

  assert.doesNotMatch(inviteSource, /validate_development_invite/);
  assert.doesNotMatch(inviteSource, /complete_development_onboarding/);
  assert.match(inviteSource, /\.from\('invites'\)/);
  assert.match(
    inviteScreen,
    /useState\(getDefaultDevelopmentInviteCode\)/,
  );
  await assert.rejects(access(removedMigrationPath));
});
