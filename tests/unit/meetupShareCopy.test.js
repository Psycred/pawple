const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMeetupShareCaption } = require('../../src/utils/meetupShareCopy');

const meetup = {
  title: 'Paw-date',
  meetup_hosts: [{ pet_id: 'pet-tyson', pets: { id: 'pet-tyson', name: 'Tyson' } }],
  meetup_participants: [{ pet_id: 'pet-tyson' }, { pet_id: 'pet-bella' }],
};

test('self-hosted meetup uses hosting copy', () => {
  const caption = buildMeetupShareCaption({
    meetup,
    ownedPetIds: ['pet-tyson'],
    activePetId: 'pet-tyson',
    viewerPets: [{ id: 'pet-tyson', name: 'Tyson' }],
    shareDateLabel: 'Friday',
  });

  assert.match(caption, /Tyson is hosting/);
  assert.doesNotMatch(caption, /attending/);
});

test('attending another hosts meetup uses attending copy', () => {
  const caption = buildMeetupShareCaption({
    meetup: {
      title: 'Park play',
      meetup_hosts: [{ pet_id: 'pet-bella', pets: { id: 'pet-bella', name: 'Bella' } }],
      meetup_participants: [{ pet_id: 'pet-bella' }, { pet_id: 'pet-tyson' }],
    },
    ownedPetIds: ['pet-tyson'],
    activePetId: 'pet-tyson',
    viewerPets: [{ id: 'pet-tyson', name: 'Tyson' }],
    shareDateLabel: 'Sunday',
  });

  assert.equal(caption, "Tyson is attending Bella's Park play Sunday");
});

test('third-party share uses host copy', () => {
  const caption = buildMeetupShareCaption({
    meetup: {
      title: 'Sunset walk',
      meetup_hosts: [{ pet_id: 'pet-bella', pets: { id: 'pet-bella', name: 'Bella' } }],
      meetup_participants: [{ pet_id: 'pet-bella' }],
    },
    ownedPetIds: ['pet-tyson'],
    activePetId: 'pet-tyson',
    viewerPets: [{ id: 'pet-tyson', name: 'Tyson' }],
    shareDateLabel: 'Monday',
  });

  assert.equal(caption, 'Bella is hosting a Sunset walk Monday');
});
