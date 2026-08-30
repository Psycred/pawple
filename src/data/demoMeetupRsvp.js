/**
 * Development-only RSVP overlay for local demo Meetups.
 *
 * The module-level Map survives Feed refreshes during the current JS session,
 * but intentionally resets when the app/Metro JavaScript runtime reloads.
 * Real Meetup RSVP state never passes through this module.
 */
const demoRsvpByMeetup = new Map();

function uniqueIds(values) {
  return [...new Set((values ?? []).map(String).filter(Boolean))];
}

function getFixtureCount(meetup) {
  const raw = Number(
    meetup?.demo_fixture_participant_count ?? meetup?.participant_count ?? 0,
  );
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function getOrCreateEntry(meetup) {
  const meetupId = String(meetup?.id ?? '');
  if (!meetupId) {
    throw new Error('Demo Meetup is required.');
  }

  let entry = demoRsvpByMeetup.get(meetupId);
  if (!entry) {
    entry = {
      fixtureParticipantCount: getFixtureCount(meetup),
      joinedPetIds: new Set(),
      petSnapshots: new Map(),
      status: meetup?.status ?? 'upcoming',
    };
    demoRsvpByMeetup.set(meetupId, entry);
  }
  return entry;
}

function snapshotViewerPets(entry, viewerPets) {
  for (const pet of viewerPets ?? []) {
    if (!pet?.id) {
      continue;
    }
    entry.petSnapshots.set(String(pet.id), {
      id: String(pet.id),
      name: String(pet.name ?? 'Pet'),
      breed: pet.breed ?? null,
      photo_url: pet.photo_url ?? null,
      pet_type: pet.pet_type ?? null,
      owner_id: pet.owner_id ?? null,
    });
  }
}

function assertOwnedPetIds(viewerPets, petIds) {
  const ownedIds = new Set((viewerPets ?? []).map((pet) => String(pet?.id)).filter(Boolean));
  if (petIds.some((id) => !ownedIds.has(String(id)))) {
    throw new Error('One or more pets do not belong to your account.');
  }
}

/**
 * Overlay the current local viewer RSVP onto a freshly generated demo fixture.
 * Fixture hosts and participants remain untouched; viewer pets are appended.
 */
export function applyDemoMeetupRsvp(meetup, viewerPets = []) {
  if (!__DEV__ || !meetup?.id) {
    return meetup;
  }

  const entry = getOrCreateEntry(meetup);
  snapshotViewerPets(entry, viewerPets);

  const fixtureParticipants = (meetup.meetup_participants ?? []).filter(
    (row) => !row?.is_demo_viewer_rsvp,
  );
  const fixtureParticipantIds = new Set(
    fixtureParticipants.map((row) => String(row?.pet_id ?? row?.pets?.id ?? '')).filter(Boolean),
  );

  const viewerParticipantRows = [...entry.joinedPetIds]
    .filter((petId) => !fixtureParticipantIds.has(String(petId)))
    .map((petId) => {
      const pet = entry.petSnapshots.get(String(petId)) ?? {
        id: String(petId),
        name: 'Pet',
        breed: null,
        photo_url: null,
        pet_type: null,
        owner_id: null,
      };
      return {
        pet_id: String(petId),
        pets: pet,
        is_demo_viewer_rsvp: true,
      };
    });

  const joinedCount = entry.joinedPetIds.size;
  return {
    ...meetup,
    status: entry.status,
    demo_fixture_participant_count: entry.fixtureParticipantCount,
    meetup_participants: [...fixtureParticipants, ...viewerParticipantRows],
    participant_count: entry.fixtureParticipantCount + joinedCount,
    viewer_joined: joinedCount > 0,
    has_joined: joinedCount > 0,
    joined: joinedCount > 0,
  };
}

/**
 * Replace the selected viewer-pet set for a demo Meetup.
 * This lets the same development sheet add or remove pets repeatedly.
 */
export function joinDemoMeetupWithPets(meetup, viewerPets, petIdsArray) {
  if (!__DEV__) {
    throw new Error('Demo meetups are previews. RSVP requires a saved meetup.');
  }

  const petIds = uniqueIds(petIdsArray);
  assertOwnedPetIds(viewerPets, petIds);
  const entry = getOrCreateEntry(meetup);
  snapshotViewerPets(entry, viewerPets);

  const nextIds = new Set(petIds.map(String));

  const limit = Number(meetup?.participation_limit);
  if (
    Number.isFinite(limit) &&
    limit > 0 &&
    entry.fixtureParticipantCount + nextIds.size > limit
  ) {
    throw new Error('This meetup is full.');
  }

  entry.joinedPetIds = nextIds;
  return applyDemoMeetupRsvp(meetup, viewerPets);
}

/** Remove only the selected viewer pets; fixture participant rows are immutable. */
export function leaveDemoMeetupWithPets(meetup, viewerPets, petIdsArray) {
  if (!__DEV__) {
    throw new Error('Demo meetups are previews. RSVP requires a saved meetup.');
  }

  const petIds = uniqueIds(petIdsArray);
  assertOwnedPetIds(viewerPets, petIds);
  const entry = getOrCreateEntry(meetup);
  snapshotViewerPets(entry, viewerPets);
  petIds.forEach((petId) => entry.joinedPetIds.delete(String(petId)));
  return applyDemoMeetupRsvp(meetup, viewerPets);
}

/** Keep a demo cancellation visible across screens for this JS session. */
export function cancelDemoMeetup(meetup) {
  if (!__DEV__) {
    throw new Error('Demo meetups are previews. Cancellation requires a saved meetup.');
  }

  const entry = getOrCreateEntry(meetup);
  entry.status = 'cancelled';
  return applyDemoMeetupRsvp(meetup);
}

/** Read-only helper used by development diagnostics. */
export function getDemoMeetupJoinedPetIds(meetupId) {
  if (!__DEV__) {
    return [];
  }
  return [...(demoRsvpByMeetup.get(String(meetupId))?.joinedPetIds ?? [])];
}

/** Demo meetup ids joined by one pet during this JavaScript session. */
export function getDemoJoinedMeetupIdsForPet(petId) {
  if (!__DEV__ || !petId) {
    return [];
  }

  const targetPetId = String(petId);
  return [...demoRsvpByMeetup.entries()]
    .filter(
      ([, entry]) =>
        entry.status !== 'cancelled' && entry.joinedPetIds.has(targetPetId),
    )
    .map(([meetupId]) => String(meetupId));
}

/** Session-local participated count for one pet across demo meetups. */
export function getDemoParticipatedMeetupCountForPet(petId) {
  return getDemoJoinedMeetupIdsForPet(petId).length;
}
