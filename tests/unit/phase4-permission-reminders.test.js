/**
 * Phase 4 — in-app permission reminders + notification type wiring.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { getNotificationDestination } from '../../src/lib/notificationNavigation.js';
import { NOTIFICATION_TYPES } from '../../src/constants/accountNotifications.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Phase 4 notification types', () => {
  it('declares permission and meetup notification types', () => {
    assert.equal(NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION, 'permission_reminder_location');
    assert.equal(NOTIFICATION_TYPES.MEETUP_GUEST_JOINED, 'meetup_guest_joined');
    assert.equal(NOTIFICATION_TYPES.MEETUP_NEARBY, 'meetup_nearby');
  });

  it('migration extends create_account_notification types', () => {
    const migration = readSrc('supabase/migrations/20260910120000_phase4_notification_types.sql');
    assert.match(migration, /meetup_guest_joined/);
    assert.match(migration, /permission_reminder_location/);
  });
});

describe('Phase 4 permission reminder UI', () => {
  it('routes Ok to Permissions screen with focus key', () => {
    const destination = getNotificationDestination({
      id: 'local:permission_reminder_location',
      type: NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION,
      payload: { focusKey: 'location' },
    });
    assert.deepEqual(destination, {
      screen: 'Permissions',
      params: { focusKey: 'location' },
    });
  });

  it('NotificationsScreen wires permission reminder rows', () => {
    const screen = readSrc('src/screens/NotificationsScreen.js');
    assert.match(screen, /PermissionReminderRow/);
    assert.match(screen, /isPermissionReminderType/);
    assert.match(screen, /dismissPermissionReminder/);
  });

  it('PermissionReminderRow uses Ok and Not now actions without a title field', () => {
    const row = readSrc('src/components/PermissionReminderRow.js');
    assert.doesNotMatch(row, /styles\.title/);
    assert.match(row, /Not now/);
    assert.match(row, /Ok/);
  });

  it('NotificationContext merges local permission reminders', () => {
    const context = readSrc('src/contexts/NotificationContext.js');
    assert.match(context, /syncPermissionReminders/);
    assert.match(context, /localPermissionReminders/);
    assert.match(context, /AppState/);
  });
});
