/**
 * 10B-B.7 / 10B-B.7a — latest user timezone + dual Meetup reminders + in-app persistence.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { NOTIFICATION_TYPES } from '../../src/constants/accountNotifications.js';
import {
  buildMeetupReminderBody,
  computeEveningBeforeReminderFireAt,
  computeMeetupReminderFireAt,
  computeMeetupReminderScheduleSlots,
  computeMorningOfReminderFireAt,
  getDeviceIanaTimezone,
  isValidIanaTimezone,
  MEETUP_REMINDER_KINDS,
} from '../../src/lib/meetupReminderTime.js';
import {
  collectMeetupReminderIds,
  filterActiveMeetupReminderNotifications,
  shouldShowMeetupReminderNotification,
} from '../../src/lib/meetupReminderNotifications.js';
import {
  getNotificationDestination,
} from '../../src/lib/notificationNavigation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

const TZ = 'Asia/Kolkata';
const meetupId = 'meetup-1';
const earlyNow = new Date('2026-10-13T00:00:00Z').getTime();

const sampleMeetup = {
  id: meetupId,
  city: 'Mumbai',
  date: '2026-10-15',
  start_time: '14:30:00',
};

describe('meetupReminderTime — notification copy', () => {
  it('builds host copy with explicit city, time, and date', () => {
    const body = buildMeetupReminderBody(sampleMeetup, 'host');
    assert.equal(
      body,
      "You're hosting a Meetup in Mumbai at 2:30 PM on 15 Oct 2026.",
    );
  });

  it('builds joiner copy with explicit city, time, and date', () => {
    const body = buildMeetupReminderBody(sampleMeetup, 'joiner');
    assert.equal(
      body,
      'You have an upcoming Meetup in Mumbai at 2:30 PM on 15 Oct 2026.',
    );
  });
});

describe('meetupReminderTime — evening-before (8 PM previous day)', () => {
  it('fires at 8:00 PM on the calendar day before the Meetup', () => {
    const fireAt = computeEveningBeforeReminderFireAt(
      { date: '2026-10-15' },
      TZ,
      earlyNow,
    );
    assert.equal(fireAt.toISOString(), '2026-10-14T14:30:00.000Z');
  });
});

describe('meetupReminderTime — morning-of rules', () => {
  it('uses 2 hours before start when Meetup starts before 10:00 AM', () => {
    const fireAt = computeMorningOfReminderFireAt(
      { date: '2026-10-15', start_time: '09:59:00' },
      TZ,
      earlyNow,
    );
    assert.equal(fireAt.toISOString(), '2026-10-15T02:29:00.000Z');
  });

  it('uses 8:00 AM on the Meetup date when start is exactly 10:00 AM', () => {
    const fireAt = computeMorningOfReminderFireAt(
      { date: '2026-10-15', start_time: '10:00:00' },
      TZ,
      earlyNow,
    );
    assert.equal(fireAt.toISOString(), '2026-10-15T02:30:00.000Z');
  });

  it('uses 8:00 AM on the Meetup date when start is after 10:00 AM', () => {
    const fireAt = computeMorningOfReminderFireAt(
      { date: '2026-10-15', start_time: '14:30:00' },
      TZ,
      earlyNow,
    );
    assert.equal(fireAt.toISOString(), '2026-10-15T02:30:00.000Z');
  });

  it('uses 2 hours before a 5:00 AM start (3:00 AM morning slot)', () => {
    const fireAt = computeMorningOfReminderFireAt(
      { date: '2026-10-15', start_time: '05:00:00' },
      TZ,
      earlyNow,
    );
    assert.equal(fireAt.toISOString(), '2026-10-14T21:30:00.000Z');
  });

  it('uses 10:00 PM previous day for a midnight start without duplicating evening-before', () => {
    const meetup = { id: meetupId, date: '2026-10-15', start_time: '00:00:00' };
    const evening = computeEveningBeforeReminderFireAt(meetup, TZ, earlyNow);
    const morning = computeMorningOfReminderFireAt(meetup, TZ, earlyNow);
    assert.equal(evening.toISOString(), '2026-10-14T14:30:00.000Z');
    assert.equal(morning.toISOString(), '2026-10-14T16:30:00.000Z');
    assert.notEqual(evening.toISOString(), morning.toISOString());
  });

  it('reschedules when recipient timezone changes', () => {
    const meetup = { date: '2026-10-15', start_time: '14:30:00' };
    const ist = computeMeetupReminderFireAt(
      meetup,
      TZ,
      earlyNow,
    );
    const est = computeMeetupReminderFireAt(
      meetup,
      'America/New_York',
      earlyNow,
    );
    assert.notEqual(ist.toISOString(), est.toISOString());
  });

  it('reads a valid device IANA timezone without location permission', () => {
    const tz = getDeviceIanaTimezone();
    assert.ok(typeof tz === 'string' && tz.length > 0);
    assert.equal(isValidIanaTimezone(tz), true);
  });
});

describe('meetupReminderTime — dual schedule slots', () => {
  it('returns exactly two reminder slots for a typical afternoon Meetup', () => {
    const slots = computeMeetupReminderScheduleSlots(
      sampleMeetup,
      'host',
      TZ,
      earlyNow,
    );
    assert.equal(slots.length, 2);
    assert.equal(slots[0].kind, MEETUP_REMINDER_KINDS.EVENING_BEFORE);
    assert.equal(slots[1].kind, MEETUP_REMINDER_KINDS.MORNING_OF);
    assert.match(slots[0].eventKey, /:evening-before$/);
    assert.match(slots[1].eventKey, /:morning-of$/);
  });

  it('deduplicates when evening-before and morning-of would fire at the same instant', () => {
    const slots = computeMeetupReminderScheduleSlots(
      { id: meetupId, date: '2026-10-15', start_time: '00:00:00' },
      'host',
      TZ,
      earlyNow,
    );
    const fireTimes = slots.map((slot) => slot.fireAt.toISOString());
    assert.equal(new Set(fireTimes).size, fireTimes.length);
    assert.ok(slots.length >= 1 && slots.length <= 2);
  });
});

describe('10B-B.7 migration contracts', () => {
  const migration = readSrc(
    'supabase/migrations/20260913210000_meetup_timezone_reminders.sql',
  );
  const meetupsService = readSrc('src/services/meetups.js');
  const authContext = readSrc('src/contexts/AuthContext.js');

  it('stores latest_timezone on profiles — not on meetups', () => {
    assert.match(migration, /profiles[\s\S]*latest_timezone/);
    assert.doesNotMatch(migration, /ALTER TABLE public\.meetups[\s\S]*timezone/);
    assert.doesNotMatch(meetupsService, /timezone_iana|meetup_timezone/);
  });

  it('updates timezone via client RPC while app is active', () => {
    assert.match(migration, /update_latest_timezone/);
    assert.match(authContext, /refreshLatestTimezoneOnAppActive/);
    assert.match(readSrc('src/lib/profileTimezone.js'), /getDeviceIanaTimezone/);
    assert.doesNotMatch(readSrc('src/lib/profileTimezone.js'), /Location\./);
  });

  it('uses one shared SQL reminder body + fire_at helpers', () => {
    assert.match(migration, /build_meetup_reminder_body/);
    assert.match(migration, /meetup_reminder_morning_fire_at/);
    assert.match(migration, /process_due_meetup_reminders/);
  });

  it('delivers reminders via existing notification + push path when app is closed', () => {
    assert.match(migration, /meetup_reminder_schedules/);
    assert.match(migration, /create_account_notification/);
    assert.match(migration, /meetup_reminder/);
    assert.match(migration, /pg_cron|process-meetup-reminders/);
  });

  it('differentiates host and joiner reminder copy in SQL', () => {
    assert.match(migration, /You''re hosting a Meetup in %s at %s on %s/);
    assert.match(migration, /You have an upcoming Meetup in %s at %s on %s/);
  });

  it('leaves unrelated notification types intact', () => {
    assert.match(migration, /'paw_received'/);
    assert.match(migration, /'meetup_guest_joined'/);
    assert.match(migration, /'meetup_nearby'/);
    assert.match(migration, /'permission_reminder_location'/);
  });

  it('removes client-only expo meetup scheduling from join/leave paths', () => {
    assert.doesNotMatch(meetupsService, /scheduleMeetupMorningReminder/);
    assert.doesNotMatch(meetupsService, /cancelMeetupMorningReminder/);
  });
});

describe('10B-B.7a migration contracts', () => {
  const migration = readSrc(
    'supabase/migrations/20260914100000_meetup_reminder_dual_schedule.sql',
  );

  it('schedules evening-before at 8 PM and morning-of with start_time rules', () => {
    assert.match(migration, /meetup_reminder_evening_before_fire_at/);
    assert.match(migration, /time '20:00:00'/);
    assert.match(migration, /meetup_reminder_morning_fire_at\(date, time, text\)/);
    assert.match(migration, /v_start_mins < 600/);
    assert.match(migration, /time '08:00:00'/);
  });

  it('uses distinct event keys for evening-before and morning-of slots', () => {
    assert.match(migration, /:evening-before/);
    assert.match(migration, /:morning-of/);
    assert.match(migration, /v_evening = v_morning/);
  });

  it('removes pending reminders when Meetup is cancelled or deleted', () => {
    assert.match(migration, /coalesce\(m\.status, 'upcoming'\) <> 'upcoming'/);
    assert.match(migration, /DELETE FROM public\.meetup_reminder_schedules[\s\S]*WHERE meetup_id = p_meetup_id/);
  });

  it('removes joiner pending reminders when user leaves Meetup', () => {
    assert.match(migration, /mrs\.role = 'joiner'/);
    assert.match(migration, /NOT EXISTS[\s\S]*meetup_participants/);
  });

  it('keeps existing notification delivery path and adds reminderSlot payload', () => {
    assert.match(migration, /create_account_notification/);
    assert.match(migration, /reminderSlot/);
    assert.doesNotMatch(migration, /DELETE FROM public\.notifications/);
  });

  it('cleans up legacy single-slot pending rows', () => {
    assert.match(migration, /DELETE FROM public\.meetup_reminder_schedules/);
    assert.match(migration, /event_key ~ '\^meetup-reminder:\[/);
  });
});

describe('meetup reminder in-app persistence', () => {
  const upcomingMeetup = {
    id: 'meetup-9',
    status: 'upcoming',
    date: '2099-12-31',
    start_time: '14:00:00',
    end_time: '16:00:00',
  };
  const pastMeetup = {
    id: 'meetup-9',
    status: 'upcoming',
    date: '2020-01-01',
    start_time: '14:00:00',
    end_time: '16:00:00',
  };
  const reminderNotification = {
    id: 'n-reminder',
    type: NOTIFICATION_TYPES.MEETUP_REMINDER,
    payload: { meetupId: 'meetup-9' },
  };
  const pawNotification = {
    id: 'n-paw',
    type: NOTIFICATION_TYPES.PAW_RECEIVED,
    payload: {},
  };

  it('keeps delivered meetup_reminder visible while Meetup is still upcoming', () => {
    const meetupById = new Map([[upcomingMeetup.id, upcomingMeetup]]);
    assert.equal(
      shouldShowMeetupReminderNotification(reminderNotification, meetupById),
      true,
    );
  });

  it('hides meetup_reminder after Meetup is complete', () => {
    const filtered = filterActiveMeetupReminderNotifications(
      [reminderNotification, pawNotification],
      [pastMeetup],
    );
    assert.deepEqual(filtered, [pawNotification]);
  });

  it('hides meetup_reminder when Meetup is cancelled or deleted', () => {
    const cancelled = filterActiveMeetupReminderNotifications(
      [reminderNotification],
      [{ ...upcomingMeetup, status: 'cancelled' }],
    );
    assert.deepEqual(cancelled, []);

    const deleted = filterActiveMeetupReminderNotifications(
      [reminderNotification],
      [],
    );
    assert.deepEqual(deleted, []);
  });

  it('leaves unrelated notification types unchanged', () => {
    const filtered = filterActiveMeetupReminderNotifications(
      [pawNotification],
      [pastMeetup],
    );
    assert.deepEqual(filtered, [pawNotification]);
  });

  it('collects meetup ids only from meetup_reminder rows', () => {
    assert.deepEqual(
      collectMeetupReminderIds([reminderNotification, pawNotification]),
      ['meetup-9'],
    );
  });

  it('filters account notification fetch results in accountNotifications service', () => {
    const service = readSrc('src/services/accountNotifications.js');
    assert.match(service, /filterActiveMeetupReminderNotifications/);
    assert.match(service, /collectMeetupReminderIds/);
    assert.doesNotMatch(service, /DELETE FROM.*notifications/);
  });
});

describe('meetup reminder notification navigation', () => {
  it('routes meetup_reminder to MeetupDetailsScreen', () => {
    assert.deepEqual(
      getNotificationDestination({
        id: 'n-reminder',
        type: NOTIFICATION_TYPES.MEETUP_REMINDER,
        payload: { meetupId: 'meetup-9' },
      }),
      {
        screen: 'MeetupDetailsScreen',
        params: { meetupId: 'meetup-9' },
      },
    );
  });

  it('keeps meetup_guest_joined navigation unchanged', () => {
    assert.deepEqual(
      getNotificationDestination({
        id: 'n-join',
        type: NOTIFICATION_TYPES.MEETUP_GUEST_JOINED,
        payload: { meetupId: 'meetup-1' },
      }),
      {
        screen: 'MeetupDetailsScreen',
        params: { meetupId: 'meetup-1' },
      },
    );
  });
});
