/**
 * Account delete smoke — delete_user_account RPC (Product Contract §10).
 * Client source: src/lib/deleteAccount.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import {
  provisionTestUser,
  createPet,
  createMoment,
  deleteAccount,
  forceDeleteUser,
} from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

test('Account delete: RPC removes profile, pets, moments, and auth user', { skip }, async () => {
  const { admin, userId, client } = await provisionTestUser({ emailPrefix: 'delete' });
  const pet = await createPet(client, userId, { name: 'DeletePet' });
  await createMoment(client, {
    userId,
    petIds: [pet.id],
    petNames: pet.name,
    caption: 'To be deleted',
  });

  const result = await deleteAccount(client);
  assert.equal(result.ok, true);

  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  assert.equal(profile, null);

  const { data: pets } = await admin.from('pets').select('id').eq('owner_id', userId);
  assert.equal(pets?.length ?? 0, 0);

  const { data: moments } = await admin.from('moments').select('id').eq('user_id', userId);
  assert.equal(moments?.length ?? 0, 0);

  const { data: authLookup, error: authError } = await admin.auth.admin.getUserById(userId);
  assert.ok(authError || !authLookup?.user, 'auth user should be removed');
});

test('Account delete: unauthenticated RPC is rejected', { skip }, async () => {
  const { createUserClient } = await import('./helpers/clients.js');
  const anonClient = createUserClient('anon-delete');
  const { error } = await anonClient.rpc('delete_user_account');
  assert.ok(error, 'expected not_authenticated or permission error');
});

test('Account delete: post-delete profile and pets are gone (admin verification)', { skip }, async () => {
  const { admin, userId, client } = await provisionTestUser({ emailPrefix: 'delete-verify' });
  await createPet(client, userId, { name: 'GonePet' });
  await deleteAccount(client);

  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  assert.equal(profile, null);
  const { data: pets } = await admin.from('pets').select('id').eq('owner_id', userId);
  assert.equal(pets?.length ?? 0, 0);
});
