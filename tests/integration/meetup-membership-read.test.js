import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@babel/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

async function transformModule(relativePath) {
  const filename = path.join(root, relativePath);
  const source = await readFile(filename, 'utf8');
  return {
    filename,
    code: transformSync(source, {
      filename,
      babelrc: false,
      configFile: false,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code,
  };
}

function loadModule(transformed, imports) {
  const module = { exports: {} };
  const wrapper = vm.runInNewContext(
    `(function (require, module, exports) { ${transformed.code}\n})`,
    { __DEV__: true, console, Map, Set, Date },
    { filename: transformed.filename },
  );
  wrapper(
    (request) => {
      if (!(request in imports)) {
        throw new Error(`Unexpected test import: ${request}`);
      }
      return imports[request];
    },
    module,
    module.exports,
  );
  return module.exports;
}

const petsModule = await transformModule('src/services/pets.js');
const meetupsModule = await transformModule('src/services/meetups.js');

function countSupabase(results) {
  return {
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async neq() {
          return results[table];
        },
      };
    },
  };
}

test('profile counts add canonical real rows and per-pet demo membership', async () => {
  const api = loadModule(petsModule, {
    '../config/supabase': {
      supabase: countSupabase({
        meetup_hosts: { count: 3, error: null },
        meetup_participants: { count: 4, error: null },
      }),
    },
    '../data/demoFeed': {
      getDemoMeetupsForFeed: () => [
        { id: 'demo-hosted', meetup_hosts: [{ pet_id: 'peter' }] },
        {
          id: 'demo-cancelled',
          status: 'cancelled',
          meetup_hosts: [{ pet_id: 'peter' }],
        },
        { id: 'demo-other', meetup_hosts: [{ pet_id: 'tyson' }] },
      ],
    },
    '../data/demoMeetupRsvp': {
      applyDemoMeetupRsvp: (meetup) => meetup,
      getDemoParticipatedMeetupCountForPet: (petId) =>
        petId === 'peter' ? 2 : 0,
    },
  });

  const counts = await api.fetchPetMeetupCounts('peter');
  assert.equal(counts.hosted_count, 4);
  assert.equal(counts.participated_count, 6);
});

test('profile count errors are surfaced instead of becoming zero', async () => {
  const countError = new Error('count denied');
  const api = loadModule(petsModule, {
    '../config/supabase': {
      supabase: countSupabase({
        meetup_hosts: { count: null, error: countError },
        meetup_participants: { count: 1, error: null },
      }),
    },
    '../data/demoFeed': { getDemoMeetupsForFeed: () => [] },
    '../data/demoMeetupRsvp': {
      applyDemoMeetupRsvp: (meetup) => meetup,
      getDemoParticipatedMeetupCountForPet: () => 0,
    },
  });

  await assert.rejects(api.fetchPetMeetupCounts('peter'), /count denied/);
});

function junctionSupabase(result) {
  return {
    from() {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

function loadMeetupsService(result) {
  return loadModule(meetupsModule, {
    '../config/supabase': { supabase: junctionSupabase(result) },
    '../data/demoMeetupRsvp': {
      joinDemoMeetupWithPets() {},
      leaveDemoMeetupWithPets() {},
    },
    '../lib/meetupPublicFilter': {
      filterShowablePublicMeetups: (meetups) => meetups,
      getMeetupStartTimestamp: () => 0,
      isShowablePublicMeetup: () => true,
    },
    '../utils/mapLinkValidation': {
      validateOptionalGoogleMapsLink: () => ({ isValid: true, value: null }),
    },
    '../utils/meetupHostDisplay': {
      formatMeetupHostedByLine: () => 'Hosted by Peter',
    },
  });
}

test('Going returns the meetup fetched through the pet participant row', async () => {
  const api = loadMeetupsService({
    data: [
      {
        meetup_id: 'real-meetup',
        pet_id: 'peter',
        meetups: {
          id: 'real-meetup',
          date: '2026-09-01',
          start_time: '10:00:00',
          status: 'upcoming',
        },
      },
    ],
    error: null,
  });

  const meetups = await api.fetchPetParticipatingMeetups('peter');
  assert.equal(meetups.length, 1);
  assert.equal(meetups[0].id, 'real-meetup');
  assert.equal(meetups[0].viewer_joined, true);
});

test('Going fetch errors are surfaced instead of becoming empty results', async () => {
  const api = loadMeetupsService({
    data: null,
    error: new Error('participant read denied'),
  });

  await assert.rejects(
    api.fetchPetParticipatingMeetups('peter'),
    /participant read denied/,
  );
});
