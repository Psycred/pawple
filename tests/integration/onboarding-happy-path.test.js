/**
 * Invite onboarding happy path — mirrors Auth → validate invite → pet → consume → complete.
 * Client source: src/lib/onboardingInvite.js, OnboardingPetsScreen.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import {
  provisionTestUser,
  createUnusedInvite,
  createPet,
  validateInviteCode,
  completeOnboarding,
  forceDeleteUser,
} from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

test('Onboarding happy path: validate invite → create pet → consume → onboarding_completed_at', { skip }, async () => {
  const inviter = await provisionTestUser({ emailPrefix: 'inviter' });
  const invitee = await provisionTestUser({
    emailPrefix: 'invitee',
    profile: { onboarding_completed_at: null },
  });

  let invite;
  try {
    invite = await createUnusedInvite(inviter.admin, inviter.userId);

    const validation = await validateInviteCode(invitee.client, invite.code, invitee.userId);
    assert.equal(validation.ok, true, `expected valid invite, got ${validation.reason}`);
    assert.ok(validation.inviteId);

    const pet = await createPet(invitee.client, invitee.userId, { name: 'OnboardingPet' });
    assert.ok(pet.id);

    const completedAt = await completeOnboarding(invitee.client, {
      userId: invitee.userId,
      inviteId: validation.inviteId,
    });
    assert.ok(completedAt);

    const { data: profile, error: profileError } = await invitee.client
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', invitee.userId)
      .single();
    assert.equal(profileError, null);
    assert.ok(profile.onboarding_completed_at);

    const { data: consumedInvite, error: inviteError } = await invitee.client
      .from('invites')
      .select('status, used_by_user_id')
      .eq('id', invite.id)
      .single();
    assert.equal(inviteError, null);
    assert.equal(consumedInvite.status, 'used');
    assert.equal(consumedInvite.used_by_user_id, invitee.userId);
  } finally {
    await forceDeleteUser(inviter.admin, invitee.userId);
    await forceDeleteUser(inviter.admin, inviter.userId);
  }
});

test('Onboarding: own invite is rejected (RLS + client guard)', { skip }, async () => {
  const inviter = await provisionTestUser({ emailPrefix: 'own-invite' });
  let invite;
  try {
    invite = await createUnusedInvite(inviter.admin, inviter.userId);
    const validation = await validateInviteCode(inviter.client, invite.code, inviter.userId);
    assert.equal(validation.ok, false);
    assert.equal(validation.reason, 'own_invite');
  } finally {
    await forceDeleteUser(inviter.admin, inviter.userId);
  }
});
