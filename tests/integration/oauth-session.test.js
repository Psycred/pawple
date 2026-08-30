/**
 * OAuth session smoke tests.
 *
 * Full Google/Apple provider flows require device/browser (F3 staging smoke).
 * F2 validates the client session contract: sign-in, persisted getSession,
 * implicit callback token exchange, and sign-out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import { createUserClient } from './helpers/clients.js';
import { provisionTestUser, forceDeleteUser } from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

test('OAuth session: sign-in persists and getSession returns user', { skip }, async () => {
  const { admin, userId, client } = await provisionTestUser({ emailPrefix: 'oauth' });
  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    assert.equal(sessionError, null);
    assert.ok(sessionData.session?.access_token);
    assert.equal(sessionData.session.user.id, userId);

    const { data: userData, error: userError } = await client.auth.getUser();
    assert.equal(userError, null);
    assert.equal(userData.user.id, userId);
  } finally {
    await forceDeleteUser(admin, userId);
  }
});

test('OAuth session: implicit callback tokens establish session (createSessionFromUrl contract)', { skip }, async () => {
  const { admin, userId, client: seedClient } = await provisionTestUser({ emailPrefix: 'oauth-callback' });
  const session = (await seedClient.auth.getSession()).data.session;
  assert.ok(session?.access_token);

  const callbackClient = createUserClient('oauth-callback-fresh');
  const { data, error } = await callbackClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  assert.equal(error, null);
  assert.equal(data.session.user.id, userId);

  await seedClient.auth.signOut();
  const { data: afterSignOut } = await callbackClient.auth.getSession();
  assert.ok(afterSignOut.session?.access_token, 'Fresh client session survives other client sign-out');

  await forceDeleteUser(admin, userId);
});

test('OAuth session: sign-out clears persisted session', { skip }, async () => {
  const { admin, userId, client } = await provisionTestUser({ emailPrefix: 'oauth-signout' });
  try {
    await client.auth.signOut();
    const { data } = await client.auth.getSession();
    assert.equal(data.session, null);
  } finally {
    await forceDeleteUser(admin, userId);
  }
});
