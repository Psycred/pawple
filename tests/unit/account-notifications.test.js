import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  getNotificationDestination,
  openAccountNotification,
} from '../../src/lib/notificationNavigation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

const pawNotification = {
  id: 'notification-1',
  type: 'paw_received',
  targetPetId: 'luna',
  actorPetId: 'buddy',
  pawInterestId: 'paw-1',
  payload: { actorPetName: 'Buddy', targetPetName: 'Luna' },
};

describe('notification destination contracts', () => {
  it('routes an incoming paw to the actor pet using the recipient pet as viewer', () => {
    assert.deepEqual(getNotificationDestination(pawNotification), {
      screen: 'ViewPetProfileScreen',
      params: {
        petId: 'buddy',
        viewerPetId: 'luna',
        pawInterestId: 'paw-1',
        source: 'notification',
      },
    });
  });

  it('routes a paw response through the same interaction surface', () => {
    const destination = getNotificationDestination({
      ...pawNotification,
      type: 'paw_response',
    });
    assert.equal(destination.screen, 'ViewPetProfileScreen');
    assert.equal(destination.params.viewerPetId, 'luna');
  });

  it('routes chat directly to the exact introduction channel', () => {
    assert.deepEqual(
      getNotificationDestination({
        id: 'notification-2',
        type: 'chat_message',
        targetPetId: 'luna',
        actorPetId: 'buddy',
        channelId: 'channel-1',
        payload: { actorPetName: 'Buddy', targetPetName: 'Luna' },
      }),
      {
        screen: 'MatingIntroductionChatScreen',
        params: {
          channelId: 'channel-1',
          petAName: 'Luna',
          petBName: 'Buddy',
          otherPetId: 'buddy',
          otherPetName: 'Buddy',
          viewerPetId: 'luna',
        },
      },
    );
  });

  it('routes intentional app announcements to their quiet detail screen', () => {
    const destination = getNotificationDestination({
      id: 'announcement-notification',
      type: 'app_announcement',
      title: 'Pawple has something new',
      body: 'A short update.',
      createdAt: '2026-09-09T00:00:00Z',
      payload: {},
    });
    assert.equal(destination.screen, 'PawpleAnnouncement');
    assert.equal(destination.params.notificationId, 'announcement-notification');
  });

  it('has no destination for likes or unknown activity', () => {
    assert.equal(
      getNotificationDestination({ id: 'like-1', type: 'like', payload: {} }),
      null,
    );
  });
});

describe('notification tap sequence', () => {
  it('marks read, switches pet context, then navigates', async () => {
    const calls = [];
    const opened = await openAccountNotification({
      notification: pawNotification,
      markRead: async (id) => calls.push(`read:${id}`),
      setPet: async (id) => calls.push(`pet:${id}`),
      navigation: {
        navigate: (screen) => calls.push(`navigate:${screen}`),
      },
    });

    assert.equal(opened, true);
    assert.deepEqual(calls, [
      'read:notification-1',
      'pet:luna',
      'navigate:ViewPetProfileScreen',
    ]);
  });
});

describe('account notification backend contract', () => {
  const migration = readSrc(
    'supabase/migrations/20260909120000_account_notifications.sql',
  );

  it('deduplicates stable events and limits reads to the recipient account', () => {
    assert.match(migration, /notifications_user_event_key_unique/);
    assert.match(migration, /ON CONFLICT \(user_id, event_key\)/);
    assert.match(migration, /USING \(user_id = auth\.uid\(\)\)/);
  });

  it('creates only Paw, response, chat, and intentional announcement events', () => {
    assert.match(migration, /'paw_received'/);
    assert.match(migration, /'paw_response'/);
    assert.match(migration, /'chat_message'/);
    assert.match(migration, /'app_announcement'/);
    assert.doesNotMatch(migration, /notify_account_after_like|trg_notifications_after_like/);
  });

  it('rejects self-action notifications in the canonical helper', () => {
    assert.match(migration, /p_from_user_id = p_user_id/);
  });

  it('keeps OS push out of Step 2', () => {
    assert.doesNotMatch(migration, /device_tokens|getExpoPushTokenAsync/);
  });
});

describe('notification centre states', () => {
  const screen = readSrc('src/screens/NotificationsScreen.js');

  it('includes calm empty, loading, error, unread, and pagination states', () => {
    assert.match(screen, /You&apos;re all caught up/);
    assert.match(screen, /ActivityIndicator/);
    assert.match(screen, /LoadErrorRetry/);
    assert.match(screen, /notificationRowUnread/);
    assert.match(screen, /onEndReached/);
  });
});
