/**
 * Permanent Moment heart smoke.
 * Requires the Step 3 migration on a non-production integration project.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import {
  createMoment,
  createPet,
  forceDeleteUser,
  provisionTestUser,
} from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

test('Moment hearts are unique, aggregate-driven, and irreversible', { skip }, async () => {
  const owner = await provisionTestUser({ emailPrefix: 'heart-owner' });
  const other = await provisionTestUser({ emailPrefix: 'heart-other' });

  try {
    const pet = await createPet(owner.client, owner.userId, { name: 'HeartPet' });
    const moment = await createMoment(owner.client, {
      userId: owner.userId,
      petIds: [pet.id],
      petNames: pet.name,
      caption: 'Permanent heart integration moment',
      momentDate: '2026-09-09',
    });

    const { data: initial, error: initialError } = await owner.client.rpc(
      'get_moment_heart_states',
      { p_moment_ids: [moment.id] },
    );
    assert.ifError(initialError);
    assert.equal(Number(initial[0].heart_count), 0);
    assert.equal(initial[0].viewer_has_hearted, false);

    const { data: first, error: firstError } = await other.client.rpc('heart_moment', {
      p_moment_id: moment.id,
    });
    assert.ifError(firstError);
    assert.equal(Number(first[0].heart_count), 1);
    assert.equal(first[0].viewer_has_hearted, true);

    const { data: repeated, error: repeatedError } = await other.client.rpc('heart_moment', {
      p_moment_id: moment.id,
    });
    assert.ifError(repeatedError);
    assert.equal(Number(repeated[0].heart_count), 1);

    const { data: ownerView, error: ownerViewError } = await owner.client.rpc(
      'get_moment_heart_states',
      { p_moment_ids: [moment.id] },
    );
    assert.ifError(ownerViewError);
    assert.equal(Number(ownerView[0].heart_count), 1);
    assert.equal(ownerView[0].viewer_has_hearted, false);

    const { data: secondUser, error: secondUserError } = await owner.client.rpc(
      'heart_moment',
      { p_moment_id: moment.id },
    );
    assert.ifError(secondUserError);
    assert.equal(Number(secondUser[0].heart_count), 2);

    const { error: deleteError } = await owner.client
      .from('likes')
      .delete()
      .eq('user_id', owner.userId)
      .eq('moment_id', moment.id);
    assert.ok(deleteError, 'authenticated clients must not remove permanent hearts');
  } finally {
    await forceDeleteUser(owner.admin, owner.userId);
    await forceDeleteUser(other.admin, other.userId);
  }
});
