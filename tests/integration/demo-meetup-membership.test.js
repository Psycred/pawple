import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@babel/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const modulePath = path.join(root, 'src', 'data', 'demoMeetupRsvp.js');
const source = await readFile(modulePath, 'utf8');
const transformedSource = transformSync(source, {
  filename: modulePath,
  babelrc: false,
  configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;

function loadDemoRsvpModule() {
  const module = { exports: {} };
  const wrapper = vm.runInNewContext(
    `(function (require, module, exports) { ${transformedSource}\n})`,
    { __DEV__: true, Map, Set, console },
    { filename: modulePath },
  );
  wrapper(
    (request) => {
      throw new Error(`Unexpected test import: ${request}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

function makeMeetup(id) {
  return {
    id,
    participant_count: 2,
    meetup_participants: [],
  };
}

const viewerPets = [
  { id: 'peter', name: 'Peter' },
  { id: 'tyson', name: 'Tyson' },
];

test('demo RSVP membership is selectable per pet and session-local', () => {
  const api = loadDemoRsvpModule();

  api.joinDemoMeetupWithPets(makeMeetup('demo-one'), viewerPets, ['peter']);
  api.joinDemoMeetupWithPets(makeMeetup('demo-two'), viewerPets, ['peter', 'tyson']);

  assert.deepEqual(
    [...api.getDemoJoinedMeetupIdsForPet('peter')].sort(),
    ['demo-one', 'demo-two'],
  );
  assert.equal(api.getDemoParticipatedMeetupCountForPet('peter'), 2);
  assert.equal(api.getDemoParticipatedMeetupCountForPet('tyson'), 1);
  assert.equal(api.getDemoParticipatedMeetupCountForPet('unknown'), 0);

  const cancelled = api.cancelDemoMeetup(makeMeetup('demo-two'));
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(api.applyDemoMeetupRsvp(makeMeetup('demo-two')).status, 'cancelled');
  assert.deepEqual([...api.getDemoJoinedMeetupIdsForPet('peter')], ['demo-one']);
  assert.equal(api.getDemoParticipatedMeetupCountForPet('tyson'), 0);

  api.leaveDemoMeetupWithPets(makeMeetup('demo-one'), viewerPets, ['peter']);
  assert.deepEqual([...api.getDemoJoinedMeetupIdsForPet('peter')], []);

  const freshSession = loadDemoRsvpModule();
  assert.equal(freshSession.getDemoParticipatedMeetupCountForPet('peter'), 0);
});
