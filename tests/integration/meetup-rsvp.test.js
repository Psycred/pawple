/**
 * Meetup RSVP smoke — host creates meetup, guest pet joins via meetup_participants.
 * Client source: src/services/meetups.js joinMeetupWithPets, createMeetup
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import {
  provisionTestUser,
  createPet,
  joinMeetupWithPets,
  forceDeleteUser,
} from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

test('Meetup RSVP: guest pet joins host meetup', { skip }, async () => {
  const host = await provisionTestUser({ emailPrefix: 'meetup-host' });
  const guest = await provisionTestUser({ emailPrefix: 'meetup-guest' });

  try {
    const hostPet = await createPet(host.client, host.userId, { name: 'HostPet' });
    const guestPet = await createPet(guest.client, guest.userId, { name: 'GuestPet' });

    const { data: meetup, error: meetupError } = await host.client
      .from('meetups')
      .insert({
        user_id: host.userId,
        title: 'Integration Park Meetup',
        date: '2026-09-01',
        start_time: '10:00:00',
        end_time: '11:00:00',
        open_to: 'Open to All',
      })
      .select('id')
      .single();
    if (meetupError) {
      throw meetupError;
    }

    const { error: hostRowError } = await host.client
      .from('meetup_hosts')
      .insert({ meetup_id: meetup.id, pet_id: hostPet.id });
    if (hostRowError) {
      throw hostRowError;
    }

    const joinResult = await joinMeetupWithPets(guest.client, meetup.id, [guestPet.id]);
    assert.equal(joinResult.joined, true);
    assert.deepEqual(joinResult.petIds, [guestPet.id]);

    const { data: participants, error: partError } = await guest.client
      .from('meetup_participants')
      .select('pet_id, meetup_id')
      .eq('meetup_id', meetup.id)
      .eq('pet_id', guestPet.id);
    assert.equal(partError, null);
    assert.equal(participants.length, 1);
  } finally {
    await forceDeleteUser(host.admin, host.userId);
    await forceDeleteUser(guest.admin, guest.userId);
  }
});

test('Meetup RSVP: cannot join with another user\'s pet (RLS)', { skip }, async () => {
  const host = await provisionTestUser({ emailPrefix: 'rsvp-host' });
  const guest = await provisionTestUser({ emailPrefix: 'rsvp-guest' });

  try {
    const hostPet = await createPet(host.client, host.userId, { name: 'HostOnlyPet' });

    const { data: meetup } = await host.client
      .from('meetups')
      .insert({
        user_id: host.userId,
        title: 'RLS Meetup',
        date: '2026-09-02',
        start_time: '14:00:00',
        end_time: '15:00:00',
        open_to: 'Open to All',
      })
      .select('id')
      .single();

    await host.client.from('meetup_hosts').insert({ meetup_id: meetup.id, pet_id: hostPet.id });

    await assert.rejects(
      () => joinMeetupWithPets(guest.client, meetup.id, [hostPet.id]),
      /do not belong to your account/,
    );
  } finally {
    await forceDeleteUser(host.admin, host.userId);
    await forceDeleteUser(guest.admin, guest.userId);
  }
});
