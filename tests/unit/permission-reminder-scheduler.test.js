import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NOTIFICATION_TYPES } from '../../src/constants/accountNotifications.js';
import {
  LOCATION_REMINDER_COPY_A,
  NOTIFICATION_REMINDER_COPY,
  PERMISSION_REMINDER_INTERVAL_MS,
} from '../../src/constants/permissionReminders.js';
import {
  buildPermissionReminderNotifications,
  isPermissionReminderType,
} from '../../src/lib/permissionReminderScheduler.js';
import {
  createDefaultPermissionReminderState,
  isPermissionReminderChannelDue,
  snoozePermissionReminderChannel,
  syncGrantedChannelState,
} from '../../src/lib/permissionReminderState.js';

describe('permission reminder scheduler', () => {
  const now = Date.parse('2026-09-10T12:00:00.000Z');

  it('does not show reminders when permissions are granted', () => {
    const state = createDefaultPermissionReminderState(now);
    const reminders = buildPermissionReminderNotifications({
      locationGranted: true,
      notificationsGranted: true,
      state,
      now,
    });
    assert.equal(reminders.length, 0);
  });

  it('shows location reminder after the seven-day window', () => {
    const state = createDefaultPermissionReminderState(now - PERMISSION_REMINDER_INTERVAL_MS - 1);
    state.location.nextEligibleAt = now - 1;
    const reminders = buildPermissionReminderNotifications({
      locationGranted: false,
      notificationsGranted: true,
      state,
      now,
    });
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].type, NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION);
    assert.equal(reminders[0].body, LOCATION_REMINDER_COPY_A);
    assert.equal(reminders[0].title, '');
  });

  it('shows notification reminder when due', () => {
    const state = createDefaultPermissionReminderState(now);
    state.notifications.nextEligibleAt = now - 1;
    const reminders = buildPermissionReminderNotifications({
      locationGranted: true,
      notificationsGranted: false,
      state,
      now,
    });
    assert.equal(reminders.length, 1);
    assert.equal(reminders[0].type, NOTIFICATION_TYPES.PERMISSION_REMINDER_NOTIFICATIONS);
    assert.equal(reminders[0].body, NOTIFICATION_REMINDER_COPY);
  });

  it('pauses while granted and resumes immediately on revoke', () => {
    let state = createDefaultPermissionReminderState(now);
    state = syncGrantedChannelState(state, 'location', true, now);
    assert.equal(isPermissionReminderChannelDue(state.location, now), false);

    state = syncGrantedChannelState(state, 'location', false, now + 1000);
    assert.equal(isPermissionReminderChannelDue(state.location, now + 1000), true);
  });

  it('snoozes for seven days and alternates location copy variant', () => {
    const state = createDefaultPermissionReminderState(now);
    const snoozed = snoozePermissionReminderChannel(state, 'location', now);
    assert.equal(
      snoozed.location.nextEligibleAt,
      now + PERMISSION_REMINDER_INTERVAL_MS,
    );
    assert.equal(snoozed.locationVariant, 1);
  });

  it('identifies permission reminder types', () => {
    assert.equal(isPermissionReminderType(NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION), true);
    assert.equal(isPermissionReminderType(NOTIFICATION_TYPES.CHAT_MESSAGE), false);
  });
});
