/**
 * Demo feed content for development / previews. Replace with Supabase `posts` + `events` when ready.
 * Dates relative to app ship window (May 2026).
 */

import { MOCK_MEETUP_VENUES } from '../utils/locationUtils';

const unsplash = (id, w = 800, h = 1000) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

/** Original Pawple Moment styles used as templates for the larger stress fixture. */
const DEMO_FEED_POST_TEMPLATES = [
  {
    id: 'd1',
    petName: 'Bruno',
    caption: 'Morning walk 🐾',
    imageUrl: unsplash('1587300003388-644179021474'),
    location: 'Bandra, Mumbai',
    dateDisplay: '2 May 2026',
    createdAt: '2026-05-02T08:15:00.000Z',
  },
  {
    id: 'd2',
    petName: 'Luna',
    caption: 'Beach day fun',
    imageUrl: unsplash('1583511655857-d19b40a7a54e'),
    location: 'Juhu, Mumbai',
    dateDisplay: '1 May 2026',
    createdAt: '2026-05-01T16:40:00.000Z',
  },
  {
    id: 'd3',
    petName: 'Max',
    caption: 'Nap time champion',
    imageUrl: unsplash('1583337130417-3346a1be7dee'),
    location: 'Powai, Mumbai',
    dateDisplay: '30 Apr 2026',
    createdAt: '2026-04-30T14:00:00.000Z',
  },
  {
    id: 'd4',
    petName: 'Bella',
    caption: 'Morning walk 🐾',
    imageUrl: unsplash('1573865526739-10659fec78a5'),
    location: 'Andheri, Mumbai',
    dateDisplay: '29 Apr 2026',
    createdAt: '2026-04-29T09:30:00.000Z',
  },
  {
    id: 'd5',
    petName: 'Charlie',
    caption: 'Beach day fun',
    imageUrl: unsplash('1514888286974-6c03e2ca1dba'),
    location: 'Bandra, Mumbai',
    dateDisplay: '28 Apr 2026',
    createdAt: '2026-04-28T11:20:00.000Z',
  },
  {
    id: 'd6',
    petName: 'Daisy',
    caption: 'Nap time champion',
    imageUrl: unsplash('1548199973-03cce0bbc87b'),
    location: 'Juhu, Mumbai',
    dateDisplay: '27 Apr 2026',
    createdAt: '2026-04-27T19:05:00.000Z',
  },
  {
    id: 'd7',
    petName: 'Bruno',
    caption: 'Beach day fun',
    imageUrl: unsplash('1560807707-8cc97660b503'),
    location: 'Powai, Mumbai',
    dateDisplay: '26 Apr 2026',
    createdAt: '2026-04-26T07:45:00.000Z',
  },
  {
    id: 'd8',
    petName: 'Luna',
    caption: 'Morning walk 🐾',
    imageUrl: unsplash('1534361960057-19889db58a07'),
    location: 'Andheri, Mumbai',
    dateDisplay: '25 Apr 2026',
    createdAt: '2026-04-25T17:10:00.000Z',
  },
  {
    id: 'd9',
    petName: 'Max',
    caption: 'Nap time champion',
    imageUrl: unsplash('1598133894008-61f7fdb0f3a4'),
    location: 'Bandra, Mumbai',
    dateDisplay: '24 Apr 2026',
    createdAt: '2026-04-24T12:00:00.000Z',
  },
];

/** Keep this large enough to exercise ten complete 9 Moments → 1 Meetup cycles. */
export const DEMO_MOMENT_COUNT = 90;

/**
 * Build deterministic-looking local Moments while keeping dates recent.
 * Content and Unsplash references cycle through the original nine Pawple templates.
 */
export function generateDemoMomentPosts() {
  const anchorDate = new Date();
  anchorDate.setUTCHours(12, 0, 0, 0);

  return Array.from({ length: DEMO_MOMENT_COUNT }, (_, index) => {
    const template = DEMO_FEED_POST_TEMPLATES[index % DEMO_FEED_POST_TEMPLATES.length];
    const momentDate = new Date(anchorDate);
    momentDate.setUTCDate(anchorDate.getUTCDate() - index);

    return {
      ...template,
      id: `d${index + 1}`,
      dateDisplay: momentDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      createdAt: momentDate.toISOString(),
    };
  });
}

/** Full local-only Moment fixture consumed by FeedScreen and the legacy demo feed. */
export const DEMO_FEED_POSTS = generateDemoMomentPosts();

/** Inline feed rotation cards (same trio as upcoming; stable ids for “Count us in”). */
export const DEMO_FEED_ROTATION_EVENTS = [
  {
    id: 'demo-ev-1',
    title: 'Weekend Dog Park - Bandra',
    location: 'Bandra, Mumbai',
    when: 'Sat · 4:00 PM',
    distanceKm: 2.4,
  },
  {
    id: 'demo-ev-2',
    title: 'Pet Cafe Social - Juhu',
    location: 'Juhu, Mumbai',
    when: 'Sun · 11:00 AM',
    distanceKm: 4.1,
  },
  {
    id: 'demo-ev-3',
    title: 'Evening Walk Group - Powai',
    location: 'Powai, Mumbai',
    when: 'Wed · 6:00 PM',
    distanceKm: 5.2,
  },
];

/** Horizontal “Upcoming Paw-Bumps” strip. */
export const DEMO_UPCOMING_EVENTS = [
  {
    id: 'up-1',
    title: 'Weekend Dog Park - Bandra',
    location: 'Bandra, Mumbai',
    when: 'Sat · 4:00 PM',
  },
  {
    id: 'up-2',
    title: 'Pet Cafe Social - Juhu',
    location: 'Juhu, Mumbai',
    when: 'Sun · 11:00 AM',
  },
  {
    id: 'up-3',
    title: 'Evening Walk Group - Powai',
    location: 'Powai, Mumbai',
    when: 'Wed · 6:00 PM',
  },
];

const DEMO_START_TIMES = ['09:00:00', '10:30:00', '11:00:00', '14:00:00', '16:00:00', '17:30:00', '18:00:00'];

/** Dev viewer pet — referenced when simulating Going-list counts. */
export const DEMO_VIEWER_PET_NAME = 'Tyson';

/**
 * Default host profiles for demo meetups — every mock meetup pulls hosts from here.
 */
export const MOCK_HOST_PETS = [
  { id: 'host-1', name: 'Bella', breed: 'Golden Retriever', photo_url: null },
  { id: 'host-2', name: 'Max', breed: 'Labrador', photo_url: null },
  { id: 'host-3', name: 'Luna', breed: 'Beagle', photo_url: null },
  { id: 'host-4', name: 'Charlie', breed: 'Poodle', photo_url: null },
  { id: 'host-5', name: 'Daisy', breed: 'German Shepherd', photo_url: null },
  { id: 'host-6', name: 'Rocky', breed: 'Bulldog', photo_url: null },
  { id: 'host-7', name: 'Molly', breed: 'Rottweiler', photo_url: null },
  { id: 'host-8', name: 'Cooper', breed: 'Corgi', photo_url: null },
];

/** Extra joiner pets beyond hosts — used to flesh out participant lists. */
const MOCK_JOINER_PETS = [
  { id: 'joiner-1', name: 'Tyson', breed: 'Beagle', photo_url: null },
  { id: 'joiner-2', name: 'Bruno', breed: 'Husky', photo_url: null },
  { id: 'joiner-3', name: 'Milo', breed: 'Corgi', photo_url: null },
  { id: 'joiner-4', name: 'Zoe', breed: 'Shih Tzu', photo_url: null },
  { id: 'joiner-5', name: 'Ruby', breed: 'Border Collie', photo_url: null },
  { id: 'joiner-6', name: 'Archie', breed: 'Indie', photo_url: null },
  { id: 'joiner-7', name: 'Nala', breed: 'Boxer', photo_url: null },
  { id: 'joiner-8', name: 'Ollie', breed: 'Dachshund', photo_url: null },
];

/** Total bulk meetups generated for feed / carousel testing. */
export const BULK_DEMO_MEETUP_COUNT = 30;

/** How future dates are bucketed (days from today). */
const BULK_DATE_BUCKETS = [
  { count: 5, minDays: 1, maxDays: 15 },
  { count: 10, minDays: 16, maxDays: 60 },
  { count: 10, minDays: 61, maxDays: 180 },
  { count: 5, minDays: 181, maxDays: 210 },
];

const BULK_MEETUP_TITLES = [
  'Beagle Playdate at Central Park',
  'Golden Retriever Social Hour',
  'Small Dog Meetup',
  'Puppy Training Session',
  'Senior Dogs Gentle Walk',
  'Dog Photography Session',
  'Agility Training Practice',
  'Breed-Specific Meetup (Poodles)',
  'Weekend Hiking Adventure',
  'Beach Day for Dogs',
  'Weekend Dog Park - Bandra',
  'Pet Cafe Social - Juhu',
  'Evening Walk Group - Powai',
  'Labrador Lovers Meetup',
  'Morning Fetch at Andheri',
  'Sunset Stroll - Marine Drive',
  'Corgi Cuddle Circle',
  'Rescue Dog Support Group',
  'Indoor Playdate (Rainy Day)',
  'Trick Training Workshop',
  'Water Play at Juhu Beach',
  'Neighborhood Sniff Walk',
  'Big Dogs Playdate',
  'Cat-Friendly Dog Social',
  'Birthday Paw-ty for Rescue Pups',
  'Therapy Dog Practice Session',
  'Urban Adventure Walk',
  'Puppy Socialization Hour',
  'Full Moon Night Walk',
  'Community Park Cleanup & Play',
];

const BULK_MEETUP_LOCATIONS = [
  {
    location_name: 'Central Park, Main Lawn',
    location: 'Central Park, Main Lawn',
    google_maps_link: 'https://www.google.com/maps/place/Central+Park',
  },
  {
    location_name: 'Riverside Dog Park',
    location: 'Riverside Dog Park',
    google_maps_link: 'https://www.google.com/maps/place/Riverside+Dog+Park',
  },
  {
    location_name: 'Sunset Beach',
    location: 'Sunset Beach',
    google_maps_link: 'https://www.google.com/maps/place/Sunset+Beach',
  },
  {
    location_name: 'Greenfield Community Park',
    location: 'Greenfield Community Park',
    google_maps_link: 'https://www.google.com/maps/place/Greenfield+Community+Park',
  },
  {
    location_name: 'Downtown Plaza',
    location: 'Downtown Plaza',
    google_maps_link: 'https://www.google.com/maps/place/Downtown+Plaza',
  },
  {
    location_name: 'Mountain Trail Head',
    location: 'Mountain Trail Head',
    google_maps_link: 'https://www.google.com/maps/place/Mountain+Trail+Head',
  },
  {
    location_name: 'Lakeside Recreation Area',
    location: 'Lakeside Recreation Area',
    google_maps_link: 'https://www.google.com/maps/place/Lakeside+Recreation+Area',
  },
];

/** Mix of close, medium, and far distances (km). */
const BULK_DISTANCE_KM = [0.5, 1.2, 1.8, 2.4, 3.2, 3.5, 5.0, 7.8, 10.0, 12.0, 18.0, 25.0, 28.0];

const BULK_PARTICIPATION_LIMITS = [10, 15, 20, 25];

const BULK_OPEN_TO_OPTIONS = [
  { openTo: 'Open to All' },
  { openTo: 'Small Dogs Only' },
  { openTo: 'Large Dogs Only' },
  { openTo: 'Puppies (Under 1 year)' },
  { openTo: 'Senior Dogs (7+ years)' },
  { openTo: 'Breed Specific', customBreedSpec: 'Golden Retrievers' },
  { openTo: 'Breed Specific', customBreedSpec: 'Beagles & Friends' },
  { openTo: 'Breed Specific', customBreedSpec: 'Poodles & Doodles' },
];

/** Morning / afternoon / evening slots with DB + display times. */
const BULK_TIME_SLOTS = [
  { start_time: '09:00:00', end_time: '11:00:00', time_start: '9:00 AM', time_end: '11:00 AM' },
  { start_time: '10:00:00', end_time: '12:00:00', time_start: '10:00 AM', time_end: '12:00 PM' },
  { start_time: '14:00:00', end_time: '16:00:00', time_start: '2:00 PM', time_end: '4:00 PM' },
  { start_time: '15:00:00', end_time: '17:00:00', time_start: '3:00 PM', time_end: '5:00 PM' },
  { start_time: '17:00:00', end_time: '19:00:00', time_start: '5:00 PM', time_end: '7:00 PM' },
  { start_time: '18:00:00', end_time: '20:00:00', time_start: '6:00 PM', time_end: '8:00 PM' },
];

const BULK_DESCRIPTIONS = [
  'Join us for a calm morning meetup with fellow paws.',
  'A relaxed afternoon hangout — all friendly dogs welcome.',
  'Evening stroll and sniff session for nearby pups.',
  'Come play, explore, and meet new furry friends.',
  'Perfect for social pups who love outdoor time.',
  'Bring water, treats, and good vibes.',
];

/** Deterministic 0–1 float so demo data is stable between reloads. */
function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898 + seed * seed * 0.137) * 43758.5453;
  return x - Math.floor(x);
}

function seededInt(seed, min, max) {
  return min + Math.floor(seededUnit(seed) * (max - min + 1));
}

function ymdFromToday(dayOffset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildBulkDayOffsets() {
  const offsets = [];
  let seed = 1;

  for (const bucket of BULK_DATE_BUCKETS) {
    for (let i = 0; i < bucket.count; i += 1) {
      offsets.push(seededInt(seed, bucket.minDays, bucket.maxDays));
      seed += 1;
    }
  }

  return offsets.sort((a, b) => a - b);
}

/** Nudge ~45% of meetups to the nearest upcoming weekend. */
function nudgeDayOffsetToWeekend(dayOffset, index) {
  if (seededUnit(index * 23) <= 0.55) {
    return dayOffset;
  }

  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  const weekday = d.getDay();

  if (weekday === 0 || weekday === 6) {
    return dayOffset;
  }

  const daysUntilSaturday = (6 - weekday + 7) % 7;
  return dayOffset + (daysUntilSaturday || 0);
}

function pickBulkHostIds(index) {
  const hostCount = seededInt(index * 3 + 1, 1, 2);
  const primaryIndex = index % MOCK_HOST_PETS.length;

  if (hostCount === 1) {
    return [MOCK_HOST_PETS[primaryIndex].id];
  }

  let secondaryIndex = (primaryIndex + seededInt(index * 5 + 2, 1, MOCK_HOST_PETS.length - 1)) % MOCK_HOST_PETS.length;
  if (secondaryIndex === primaryIndex) {
    secondaryIndex = (secondaryIndex + 1) % MOCK_HOST_PETS.length;
  }

  return [MOCK_HOST_PETS[primaryIndex].id, MOCK_HOST_PETS[secondaryIndex].id];
}

/** hosts + 1–8 joiners, clamped to 2–10 total pets. */
function resolveBulkParticipantCount(hostCount, index) {
  const extra = seededInt(index * 7 + 2, 1, 8);
  let total = hostCount + extra;
  total = Math.max(2, Math.min(10, total));
  total = Math.max(total, hostCount);
  return { total, extraParticipants: total - hostCount };
}

function buildBulkHostScenario(index) {
  const hostPetIds = pickBulkHostIds(index);
  const hostCount = hostPetIds.length;
  const { total, extraParticipants } = resolveBulkParticipantCount(hostCount, index);
  const openPreset = BULK_OPEN_TO_OPTIONS[index % BULK_OPEN_TO_OPTIONS.length];

  return {
    hostPetIds,
    extraParticipants,
    participantCount: total,
    openTo: openPreset.openTo,
    customBreedSpec: openPreset.customBreedSpec ?? null,
    participationLimit: BULK_PARTICIPATION_LIMITS[index % BULK_PARTICIPATION_LIMITS.length],
    viewerIsGoing: index % 9 === 0 || index % 11 === 0,
  };
}

function resolveHostPets(hostPetIds, fallbackIndex = 0) {
  const ids = hostPetIds?.length
    ? hostPetIds
    : [MOCK_HOST_PETS[fallbackIndex % MOCK_HOST_PETS.length].id];

  return ids.map((id) => MOCK_HOST_PETS.find((pet) => pet.id === id) ?? MOCK_HOST_PETS[0]);
}

/** Total includes all hosts; single-host cards never show “1 pet joining”. */
function resolveParticipantCount(hostCount, extraParticipants = 0) {
  const extra = Math.max(0, Number(extraParticipants) || 0);
  let total = hostCount + extra;

  if (hostCount === 1) {
    total = Math.max(total, 2);
  }

  return Math.max(total, hostCount);
}

function buildMeetupParticipants(hostPets, extraParticipants = 0) {
  const hostIds = new Set(hostPets.map((pet) => String(pet.id)));
  const participants = hostPets.map((pet) => ({
    pet_id: pet.id,
    pets: {
      id: pet.id,
      name: pet.name,
      breed: pet.breed,
      photo_url: pet.photo_url ?? null,
    },
  }));

  let joinerIndex = 0;
  for (let i = 0; i < extraParticipants; i += 1) {
    const joiner = MOCK_JOINER_PETS[joinerIndex % MOCK_JOINER_PETS.length];
    joinerIndex += 1;
    if (hostIds.has(String(joiner.id))) {
      continue;
    }
    participants.push({
      pet_id: joiner.id,
      pets: {
        id: joiner.id,
        name: joiner.name,
        breed: joiner.breed,
        photo_url: joiner.photo_url ?? null,
      },
    });
  }

  return participants;
}

function buildDemoHosts(scenario, fallbackIndex = 0) {
  const hostPets = resolveHostPets(scenario.hostPetIds, fallbackIndex);
  const hostCount = hostPets.length;
  const participantCount =
    scenario.participantCount ??
    resolveParticipantCount(hostCount, scenario.extraParticipants);
  const meetupHosts = hostPets.map((pet) => ({
    pet_id: pet.id,
    pets: { name: pet.name, breed: pet.breed, photo_url: pet.photo_url ?? null },
  }));
  const meetupParticipants = buildMeetupParticipants(hostPets, scenario.extraParticipants);
  return {
    participant_count: participantCount,
    participation_limit: scenario.participationLimit ?? 25,
    meetup_hosts: meetupHosts,
    meetup_participants: meetupParticipants,
    viewer_joined: Boolean(scenario.viewerIsGoing),
  };
}

function formatDistanceLabel(km) {
  const rounded = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${rounded} km`;
}

function buildBulkDescription(title, openTo) {
  const base = BULK_DESCRIPTIONS[title.length % BULK_DESCRIPTIONS.length];
  if (openTo === 'Open to All') {
    return base;
  }
  return `${base} (${openTo}).`;
}

function buildBulkMeetupRow(index, dayOffset) {
  const venue = MOCK_MEETUP_VENUES[index % MOCK_MEETUP_VENUES.length];
  const locationMeta = BULK_MEETUP_LOCATIONS[index % BULK_MEETUP_LOCATIONS.length];
  const scenario = buildBulkHostScenario(index);
  const host = buildDemoHosts(scenario, index);
  const title = BULK_MEETUP_TITLES[index % BULK_MEETUP_TITLES.length];
  const timeSlot = BULK_TIME_SLOTS[index % BULK_TIME_SLOTS.length];
  const openTo = scenario.openTo;
  const customBreedSpec = scenario.customBreedSpec ?? null;
  const distanceKm = BULK_DISTANCE_KM[index % BULK_DISTANCE_KM.length];
  const adjustedDayOffset = nudgeDayOffsetToWeekend(dayOffset, index);

  return {
    id: `demo-${index + 1}`,
    title,
    location: locationMeta.location,
    location_name: locationMeta.location_name,
    date: ymdFromToday(adjustedDayOffset),
    start_time: timeSlot.start_time,
    end_time: timeSlot.end_time,
    time_start: timeSlot.time_start,
    time_end: timeSlot.time_end,
    status: 'upcoming',
    open_to: openTo,
    custom_breed_spec: customBreedSpec,
    description: buildBulkDescription(title, openTo),
    google_maps_link: locationMeta.google_maps_link,
    meetup_hosts: host.meetup_hosts,
    meetup_participants: host.meetup_participants,
    participant_count: host.participant_count,
    participation_limit: host.participation_limit,
    viewer_joined: host.viewer_joined,
    distanceKm,
    distance_km: distanceKm,
    distance: formatDistanceLabel(distanceKm),
    location_lat: venue.location_lat,
    location_lng: venue.location_lng,
  };
}

/**
 * Generate 30 demo meetups spread from 15 days to ~7 months out.
 * Dates, hosts, and counts are deterministic (stable across reloads).
 */
export function generateBulkDemoMeetups() {
  const dayOffsets = buildBulkDayOffsets();

  return dayOffsets.map((dayOffset, index) =>
    buildBulkMeetupRow(index, dayOffset),
  );
}

/** Meetup rows for FeedScreen / EventCarousel — full bulk dataset for scroll testing. */
export function getDemoMeetupsForFeed() {
  console.log('[DemoFeed] Generating bulk meetups, target count:', BULK_DEMO_MEETUP_COUNT);
  const meetups = generateBulkDemoMeetups();
  console.log('[DemoFeed] Returning meetups, count:', meetups.length);
  return meetups;
}

/** Moment rows for FeedScreen (maps demo posts → `moments` / `memories` shape). */
export function getDemoMomentsForFeed() {
  return DEMO_FEED_POSTS.map((post) => ({
    id: post.id,
    photo_url: post.imageUrl,
    caption: post.caption,
    location: post.location,
    memory_date: post.dateDisplay,
    created_at: post.createdAt,
    pet_names: post.petName,
  }));
}

/** Keep demo-only interactions from being sent to the real moments backend. */
export function isDemoMomentId(id) {
  return typeof id === 'string' && /^d\d+$/.test(id);
}

/** Use demo scrapbook content when Supabase returns no feed rows. */
export const USE_DEMO_FEED_WHEN_EMPTY = true;

/** Dev/testing: surface all generated demo meetups in carousel + vertical feed. */
export const DEMO_FEED_SHOW_ALL_MEETUPS = true;

/** Final product rule: the top carousel contains exactly three Meetups. */
export const DEMO_FEED_CAROUSEL_SIZE = 3;
