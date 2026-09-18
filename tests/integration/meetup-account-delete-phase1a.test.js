/**
 * 10B-B.6 — Phase 1A meetup account delete (hard-delete owned meetups).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import {
  provisionTestUser,
  createPet,
  joinMeetupWithPets,
  deleteAccount,
  forceDeleteUser,
} from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

const PAST_MEETUP_DATE = '2020-01-15';
const FUTURE_MEETUP_DATE = '2099-06-01';

async function createHostedMeetup(client, userId, petId, { title, date }) {
  const { data: meetup, error: meetupError } = await client
    .from('meetups')
    .insert({
      user_id: userId,
      title,
      date,
      start_time: '10:00:00',
      end_time: '11:00:00',
      open_to: 'Open to All',
    })
    .select('id')
    .single();
  if (meetupError) {
    throw meetupError;
  }

  const { error: hostError } = await client
    .from('meetup_hosts')
    .insert({ meetup_id: meetup.id, pet_id: petId });
  if (hostError) {
    throw hostError;
  }

  return meetup.id;
}

test('Account delete: hard-deletes upcoming hosted meetup and is not blocked', { skip }, async () => {
  const host = await provisionTestUser({ emailPrefix: 'phase1a-upcoming-host' });
  let meetupId;

  try {
    const hostPet = await createPet(host.client, host.userId, { name: 'UpcomingHostPet' });
    meetupId = await createHostedMeetup(host.client, host.userId, hostPet.id, {
      title: 'Upcoming Phase1A Meetup',
      date: FUTURE_MEETUP_DATE,
    });

    const result = await deleteAccount(host.client);
    assert.equal(result.ok, true);

    const { data: meetup } = await host.admin
      .from('meetups')
      .select('id')
      .eq('id', meetupId)
      .maybeSingle();
    assert.equal(meetup, null);
  } finally {
    if (meetupId) {
      await host.admin.from('meetup_participants').delete().eq('meetup_id', meetupId);
      await host.admin.from('meetup_hosts').delete().eq('meetup_id', meetupId);
      await host.admin.from('meetups').delete().eq('id', meetupId);
    }
    await forceDeleteUser(host.admin, host.userId);
  }
});

test('Account delete: hard-deletes past hosted meetup', { skip }, async () => {
  const host = await provisionTestUser({ emailPrefix: 'phase1a-past-host' });
  let meetupId;

  try {
    const hostPet = await createPet(host.client, host.userId, { name: 'PastHostPet' });
    meetupId = await createHostedMeetup(host.client, host.userId, hostPet.id, {
      title: 'Past Phase1A Meetup',
      date: PAST_MEETUP_DATE,
    });

    await deleteAccount(host.client);

    const { data: meetup } = await host.admin
      .from('meetups')
      .select('id')
      .eq('id', meetupId)
      .maybeSingle();
    assert.equal(meetup, null);
  } finally {
    if (meetupId) {
      await host.admin.from('meetup_participants').delete().eq('meetup_id', meetupId);
      await host.admin.from('meetup_hosts').delete().eq('meetup_id', meetupId);
      await host.admin.from('meetups').delete().eq('id', meetupId);
    }
    await forceDeleteUser(host.admin, host.userId);
  }
});

test('Account delete: joined-only participant removal leaves host meetup', { skip }, async () => {
  const host = await provisionTestUser({ emailPrefix: 'phase1a-host-remain' });
  const guest = await provisionTestUser({ emailPrefix: 'phase1a-guest-leave' });
  let meetupId;

  try {
    const hostPet = await createPet(host.client, host.userId, { name: 'RemainHostPet' });
    const guestPet = await createPet(guest.client, guest.userId, { name: 'GuestPet' });

    meetupId = await createHostedMeetup(host.client, host.userId, hostPet.id, {
      title: 'Host Remains Meetup',
      date: FUTURE_MEETUP_DATE,
    });

    await joinMeetupWithPets(guest.client, meetupId, [guestPet.id]);
    await deleteAccount(guest.client);

    const { data: retained } = await host.admin
      .from('meetups')
      .select('id, user_id')
      .eq('id', meetupId)
      .maybeSingle();
    assert.ok(retained, 'host meetup should remain');
    assert.equal(retained.user_id, host.userId);

    const { data: guestRows } = await host.admin
      .from('meetup_participants')
      .select('id')
      .eq('meetup_id', meetupId)
      .eq('pet_id', guestPet.id);
    assert.equal(guestRows?.length ?? 0, 0);
  } finally {
    if (meetupId) {
      await host.admin.from('meetup_participants').delete().eq('meetup_id', meetupId);
      await host.admin.from('meetup_hosts').delete().eq('meetup_id', meetupId);
      await host.admin.from('meetups').delete().eq('id', meetupId);
    }
    await forceDeleteUser(guest.admin, guest.userId);
    await forceDeleteUser(host.admin, host.userId);
  }
});
