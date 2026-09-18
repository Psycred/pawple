/**
 * MeetupCard layout + data contract — unit tests.
 * Run: node --test tests/unit/meetup-card-layout.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('MeetupCard layout contract', () => {
  const source = readSrc('src/components/MeetupCard.js');

  it('preserves established card sizing', () => {
    assert.match(source, /card:\s*\{\s*width:\s*'100%'/);
    assert.match(source, /paddingHorizontal:\s*24/);
    assert.match(source, /paddingVertical:\s*24/);
    assert.match(source, /borderRadius:\s*20/);
  });

  it('keeps the title alone at the top without a header icon row', () => {
    assert.match(source, /<Text[\s\S]*style=\{\[styles\.title/);
    assert.doesNotMatch(source, /headerRow/);
    assert.doesNotMatch(source, /iconBox/);
  });

  it('shows creator-entered venue and city from meetup data', () => {
    assert.match(source, /meetup\?\.location_name/);
    assert.match(source, /formatCityBadge\(meetup\?\.city\)/);
    assert.doesNotMatch(source, /profileCity/);
  });

  it('uses only one calendar icon in the date/time section', () => {
    const calendarMatches = source.match(/name="calendar"/g) ?? [];
    assert.equal(calendarMatches.length, 1);
    assert.match(source, /hasSchedule \|\| showLocationActions/);
  });

  it('places distance and Directions in the date/time action panel', () => {
    assert.match(source, /locationActionsPanel/);
    assert.match(source, /showLocationActions = Boolean\(distanceLabel \|\| mapsLink\)/);
    assert.match(source, /locationActionsPanel[\s\S]*distanceRow/);
    assert.doesNotMatch(source, /distancePill/);
  });

  it('opens the exact stored maps URL and only shows distance from venue coords', () => {
    assert.match(source, /Linking\.openURL\(mapsLink\)/);
    assert.match(source, /meetup\?\.distanceKm/);
    assert.doesNotMatch(source, /meetupGpsToCityCentroidKm/);
    assert.doesNotMatch(source, /minMeetupCityDistanceKm/);
  });

  it('supports independent distance and Directions visibility', () => {
    assert.match(source, /\{distanceLabel \? \(/);
    assert.match(source, /\{mapsLink \? \(/);
    assert.match(source, /directionsLink/);
  });

  it('preserves existing CTA labels and behavior hooks', () => {
    assert.match(source, /Count Us In/);
    assert.match(source, /You're Going/);
    assert.match(source, /Event Full/);
    assert.match(source, /Completed/);
    assert.match(source, /Manage/);
    assert.match(source, /isMeetupPast/);
  });

  it('uses existing hosted-by and participant data helpers', () => {
    assert.match(source, /formatMeetupCardHostedByLine/);
    assert.match(source, /participant_count/);
    assert.match(source, /participation_limit/);
    assert.match(source, /open_to/);
  });
});
