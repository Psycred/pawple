/**
 * Static audit: demo injection flags must compile to false outside local dev.
 * Run: node scripts/verify-demo-gating.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const environment = read('src/config/environment.js');
assert(
  environment.includes('export const isDemoContentEnabled = __DEV__'),
  'environment.js must tie isDemoContentEnabled to __DEV__',
);

const demoFeed = read('src/data/demoFeed.js');
assert(
  demoFeed.includes('isDemoContentEnabled'),
  'demoFeed.js must import/use isDemoContentEnabled',
);
assert(
  !/export const USE_DEMO_FEED_WHEN_EMPTY = true/.test(demoFeed),
  'USE_DEMO_FEED_WHEN_EMPTY must not be hardcoded true',
);
assert(
  demoFeed.includes('if (!isDemoContentEnabled)'),
  'getDemo* helpers must no-op when demo content is disabled',
);

const feedScreen = read('src/screens/FeedScreen.js');
assert(
  feedScreen.includes('USE_DEMO_FEED_WHEN_EMPTY'),
  'FeedScreen must gate demo merge on USE_DEMO_FEED_WHEN_EMPTY',
);

const demoRsvp = read('src/data/demoMeetupRsvp.js');
assert(
  (demoRsvp.match(/if \(!__DEV__\)/g) || []).length >= 3,
  'demoMeetupRsvp.js must guard RSVP paths with __DEV__',
);

const meetupsService = read('src/services/meetups.js');
assert(
  meetupsService.includes('!__DEV__') && meetupsService.includes('isDemoMeetupId'),
  'meetups.js join/leave must reject demo RSVP outside __DEV__',
);

const babel = read('babel.config.js');
assert(
  babel.includes('babel-preset-expo'),
  'babel.config.js must use babel-preset-expo (compiles __DEV__ false in release)',
);

if (failures.length) {
  console.error('Demo gating verification failed:\n');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log('Demo gating verification passed.');
console.log('Release builds: __DEV__=false via babel-preset-expo → isDemoContentEnabled=false.');
