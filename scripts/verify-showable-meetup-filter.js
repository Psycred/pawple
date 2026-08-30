/**
 * Unit checks for public showable meetup filter (Fix 2 / PAW-28).
 * Run: node scripts/verify-showable-meetup-filter.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function getMeetupStartTimestamp(meetup) {
  const dateStr = String(meetup?.date ?? '').split('T')[0];
  const timeStr = String(meetup?.start_time ?? '00:00:00').slice(0, 8);
  const parsed = new Date(`${dateStr}T${timeStr}`);
  const ts = parsed.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function isShowablePublicMeetup(meetup, nowMs = Date.now()) {
  const status = meetup?.status ?? 'upcoming';
  if (status !== 'upcoming') {
    return false;
  }
  const startTs = getMeetupStartTimestamp(meetup);
  if (startTs == null) {
    return false;
  }
  return startTs > nowMs;
}

function filterShowablePublicMeetups(meetups = [], nowMs = Date.now()) {
  return meetups.filter((meetup) => isShowablePublicMeetup(meetup, nowMs));
}

const source = fs.readFileSync(path.join(root, 'src/services/meetups.js'), 'utf8');
assert(
  source.includes('filterShowablePublicMeetups'),
  'meetups.js must export filterShowablePublicMeetups',
);

const libSource = fs.readFileSync(path.join(root, 'src/lib/meetupPublicFilter.js'), 'utf8');
assert(
  libSource.includes('export function filterShowablePublicMeetups'),
  'meetupPublicFilter.js must define filterShowablePublicMeetups',
);

const fixedNow = new Date('2026-08-30T14:00:00').getTime();

const future = {
  id: '1',
  status: 'upcoming',
  date: '2026-09-01',
  start_time: '10:00:00',
};
const started = {
  id: '2',
  status: 'upcoming',
  date: '2026-08-30',
  start_time: '13:00:00',
};
const cancelled = {
  id: '3',
  status: 'cancelled',
  date: '2026-09-01',
  start_time: '10:00:00',
};
const completed = {
  id: '4',
  status: 'completed',
  date: '2026-09-01',
  start_time: '10:00:00',
};
const exactStart = {
  id: '5',
  status: 'upcoming',
  date: '2026-08-30',
  start_time: '14:00:00',
};

assert(isShowablePublicMeetup(future, fixedNow), 'future upcoming meetup is showable');
assert(!isShowablePublicMeetup(started, fixedNow), 'started meetup is not showable');
assert(!isShowablePublicMeetup(cancelled, fixedNow), 'cancelled meetup is not showable');
assert(!isShowablePublicMeetup(completed, fixedNow), 'completed meetup is not showable');
assert(
  !isShowablePublicMeetup(exactStart, fixedNow),
  'meetup at exact start time is not showable (beta rule)',
);

const filtered = filterShowablePublicMeetups(
  [future, started, cancelled, completed, exactStart],
  fixedNow,
);
assert(
  filtered.map((m) => m.id).join(',') === '1',
  `filterShowablePublicMeetups keeps only future upcoming; got ${filtered.map((m) => m.id).join(',')}`,
);

if (failures.length) {
  console.error('verify-showable-meetup-filter FAILED:\n', failures.join('\n'));
  process.exit(1);
}

console.log('verify-showable-meetup-filter OK');
