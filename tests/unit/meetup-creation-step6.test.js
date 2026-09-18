import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Step 6 Meetup creation', () => {
  const screen = readSrc('src/screens/CreateMeetupScreen.js');
  const service = readSrc('src/services/meetups.js');
  const migration = readSrc(
    'supabase/migrations/20260909140000_meetup_city_description_step6.sql',
  );

  it('uses the existing description contract for an optional About field', () => {
    assert.match(screen, />\s*About\s*</);
    assert.match(screen, /value=\{description\}/);
    assert.match(screen, /description:\s*description\.trim\(\) \|\| null/);
    assert.match(service, /description:\s*input\.description\?\.trim\(\) \|\| null/g);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS description text/i);
  });

  it('prefills current device city while preserving manual edits', () => {
    assert.match(screen, /captureLocationOnUserConsent\(\)/);
    assert.match(screen, /resolveCityFromCoords\(/);
    assert.match(screen, /cacheViewerFeedLocation\(location\.coords,\s*detectedCity\)/);
    assert.match(screen, /cityEditedRef\.current/);
    assert.match(screen, /setMeetupCity\(detectedCity\)/);
    assert.match(screen, /accessibilityLabel="City"/);
    assert.doesNotMatch(screen, /setProfileCity|Add your city in profile settings first/);

    const moments = readSrc('src/services/moments.js');
    assert.match(moments, /cached\?\.city \?\? data\?\.city/);
  });

  it('maps normalized editable city through create and update payloads', () => {
    assert.match(screen, /city:\s*normalizeCityForSave\(meetupCity\)/);
    assert.match(service, /const city = normalizeCityForSave\(input\.city\)/g);
    assert.match(service, /Meetup city is required\./);
    assert.match(service, /description:\s*input\.description\?\.trim\(\) \|\| null,\s*city,/g);
  });

  it('replaces only the profile-city override trigger behavior', () => {
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.meetups_apply_creator_city/);
    assert.match(migration, /NEW\.city := btrim\(coalesce\(NEW\.city, ''\)\)/);
    assert.doesNotMatch(migration, /FROM public\.profiles|UPDATE public\.meetups|DROP TABLE/);
  });
});

describe('Step 6 Meetup presentation scope', () => {
  it('removes the corrupt paw prefix from the participant count', () => {
    const details = readSrc('src/screens/MeetupDetailsScreen.js');
    assert.match(details, /\$\{participantCount\}.*pets joining/);
    assert.doesNotMatch(details, /ðŸ¾/);
    assert.match(details, /<DetailSection label="ABOUT">/);
  });

  it('does not change established Meetup card sizing contracts', () => {
    const card = readSrc('src/components/MeetupCard.js');
    const carousel = readSrc('src/components/EventCarousel.js');

    assert.match(card, /card:\s*\{\s*width:\s*'100%'/);
    assert.match(card, /paddingHorizontal:\s*24/);
    assert.match(card, /paddingVertical:\s*24/);
    assert.match(carousel, /theme\.feed\.carouselCardWidthRatio/);
  });
});
