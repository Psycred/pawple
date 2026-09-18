/**
 * Phase 5 — meetup server notifications, device tokens, and push registration.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildNotificationFromPushData,
  getNotificationDestination,
} from '../../src/lib/notificationNavigation.js';
import { NOTIFICATION_TYPES } from '../../src/constants/accountNotifications.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Phase 5 migration contracts', () => {
  const migration = readSrc(
    'supabase/migrations/20260910150000_phase5_meetup_push_notifications.sql',
  );

  it('creates device_tokens and push token RPCs', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.device_tokens/);
    assert.match(migration, /upsert_device_push_token/);
    assert.match(migration, /remove_device_push_token/);
  });

  it('notifies meetup hosts when guests join', () => {
    assert.match(migration, /notify_host_after_meetup_guest_join/);
    assert.match(migration, /meetup_guest_joined/);
    assert.match(migration, /REFERENCING NEW TABLE AS inserted_rows/);
    assert.match(migration, /NOT EXISTS \(\s*SELECT 1\s*FROM public\.meetup_hosts/);
  });

  it('notifies nearby users within 100 km when a meetup is created', () => {
    assert.match(migration, /notify_nearby_after_meetup_create/);
    assert.match(migration, /meetup_nearby/);
    assert.match(migration, /haversine_km/);
    assert.match(migration, /\)\s*<=\s*100/);
  });

  it('dispatches Expo push when notification_enabled and pg_net is available', () => {
    assert.match(migration, /dispatch_account_notification_push/);
    assert.match(migration, /notification_enabled IS NOT TRUE/);
    assert.match(migration, /exp\.host\/--\/api\/v2\/push\/send/);
  });
});

describe('Phase 5 notification navigation', () => {
  it('routes meetup guest joined notifications to MeetupDetailsScreen', () => {
    assert.deepEqual(
      getNotificationDestination({
        id: 'n-1',
        type: NOTIFICATION_TYPES.MEETUP_GUEST_JOINED,
        payload: { meetupId: 'meetup-1' },
      }),
      {
        screen: 'MeetupDetailsScreen',
        params: { meetupId: 'meetup-1' },
      },
    );
  });

  it('routes nearby meetup notifications to MeetupDetailsScreen', () => {
    assert.deepEqual(
      getNotificationDestination({
        id: 'n-2',
        type: NOTIFICATION_TYPES.MEETUP_NEARBY,
        payload: { meetupId: 'meetup-2' },
      }),
      {
        screen: 'MeetupDetailsScreen',
        params: { meetupId: 'meetup-2' },
      },
    );
  });
});

describe('Phase 5 push client wiring', () => {
  it('registers device tokens after OS notification permission is granted', () => {
    const notifications = readSrc('src/lib/notifications.js');
    assert.match(notifications, /registerDevicePushTokenIfGranted/);

    const authContext = readSrc('src/contexts/AuthContext.js');
    assert.match(authContext, /syncDevicePushRegistration/);

    const permissions = readSrc('src/screens/PermissionsScreen.js');
    assert.match(permissions, /registerDevicePushTokenIfGranted/);
  });

  it('clears cached push tokens on sign out', () => {
    const authSession = readSrc('src/lib/authSession.js');
    assert.match(authSession, /unregisterCachedDevicePushToken/);
  });

  it('builds navigation payloads from OS push data', () => {
    const notification = buildNotificationFromPushData({
      notificationId: 'push-1',
      type: NOTIFICATION_TYPES.MEETUP_NEARBY,
      meetupId: 'meetup-9',
    });

    assert.equal(notification.id, 'push-1');
    assert.equal(notification.payload.meetupId, 'meetup-9');
    assert.equal(
      getNotificationDestination(notification)?.screen,
      'MeetupDetailsScreen',
    );
  });
});
