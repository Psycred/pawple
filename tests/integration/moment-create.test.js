/**
 * Moment create smoke — authenticated insert into moments with pet attribution.
 * Client source: src/services/moments.js createMoment
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import { provisionTestUser, createPet, createMoment, forceDeleteUser } from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

test('Moment create: authenticated user inserts moment with pet attribution', { skip }, async () => {
  const { admin, userId, client } = await provisionTestUser({ emailPrefix: 'moment' });
  try {
    const pet = await createPet(client, userId, { name: 'MomentPet' });
    const moment = await createMoment(client, {
      userId,
      petIds: [pet.id],
      petNames: pet.name,
      caption: 'Integration smoke moment',
      momentDate: '2026-08-28',
    });

    assert.ok(moment.id);
    assert.equal(moment.user_id, userId);
    assert.equal(moment.caption, 'Integration smoke moment');

    const { data: fetched, error } = await client
      .from('moments')
      .select('id, user_id, pet_ids, pet_names')
      .eq('id', moment.id)
      .single();
    assert.equal(error, null);
    assert.equal(fetched.user_id, userId);
    assert.ok(fetched.pet_ids?.includes(pet.id) || fetched.pet_ids?.includes(String(pet.id)));
  } finally {
    await forceDeleteUser(admin, userId);
  }
});

test('Moment create: RLS blocks insert for another user_id', { skip }, async () => {
  const owner = await provisionTestUser({ emailPrefix: 'moment-owner' });
  const other = await provisionTestUser({ emailPrefix: 'moment-other' });
  try {
    const pet = await createPet(owner.client, owner.userId, { name: 'OwnerPet' });
    const { error } = await other.client.from('moments').insert({
      user_id: owner.userId,
      image_url: 'https://example.com/forged.jpg',
      caption: 'Should fail RLS',
      moment_date: '2026-08-28',
      pet_ids: [pet.id],
      pet_names: pet.name,
    });
    assert.ok(error, 'expected RLS to reject cross-user moment insert');
  } finally {
    await forceDeleteUser(owner.admin, owner.userId);
    await forceDeleteUser(other.admin, other.userId);
  }
});
