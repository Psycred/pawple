import { NOTIFICATION_TYPES } from '../constants/accountNotifications.js';

export function buildNotificationFromPushData(data) {
  if (!data?.notificationId || !data?.type) {
    return null;
  }

  return {
    id: String(data.notificationId),
    type: data.type,
    targetPetId: data.targetPetId ? String(data.targetPetId) : null,
    actorPetId: data.actorPetId ? String(data.actorPetId) : null,
    channelId: data.channelId ? String(data.channelId) : null,
    pawInterestId: data.pawInterestId ? String(data.pawInterestId) : null,
    title: data.title ?? 'Pawple',
    body: data.body ?? '',
    payload:
      data.payload && typeof data.payload === 'object'
        ? data.payload
        : {
            meetupId: data.meetupId,
            actorPetName: data.actorPetName,
            targetPetName: data.targetPetName,
          },
  };
}

export function getNotificationDestination(notification) {
  if (!notification) {
    return null;
  }

  const actorPetName = notification.payload?.actorPetName ?? 'Pet';
  const targetPetName = notification.payload?.targetPetName ?? 'Pet';

  if (
    notification.type === NOTIFICATION_TYPES.PAW_RECEIVED ||
    notification.type === NOTIFICATION_TYPES.PAW_RESPONSE
  ) {
    if (!notification.actorPetId || !notification.targetPetId) {
      return null;
    }
    return {
      screen: 'ViewPetProfileScreen',
      params: {
        petId: notification.actorPetId,
        viewerPetId: notification.targetPetId,
        pawInterestId: notification.pawInterestId,
        source: 'notification',
      },
    };
  }

  if (notification.type === NOTIFICATION_TYPES.CHAT_MESSAGE) {
    if (!notification.channelId || !notification.targetPetId) {
      return null;
    }
    return {
      screen: 'MatingIntroductionChatScreen',
      params: {
        channelId: notification.channelId,
        petAName: targetPetName,
        petBName: actorPetName,
        otherPetId: notification.actorPetId,
        otherPetName: actorPetName,
        viewerPetId: notification.targetPetId,
      },
    };
  }

  if (notification.type === NOTIFICATION_TYPES.APP_ANNOUNCEMENT) {
    return {
      screen: 'PawpleAnnouncement',
      params: {
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        createdAt: notification.createdAt,
      },
    };
  }

  if (
    notification.type === NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION ||
    notification.type === NOTIFICATION_TYPES.PERMISSION_REMINDER_NOTIFICATIONS
  ) {
    const focusKey =
      notification.payload?.focusKey ??
      (notification.type === NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION
        ? 'location'
        : 'notifications');
    return {
      screen: 'Permissions',
      params: { focusKey },
    };
  }

  if (notification.type === NOTIFICATION_TYPES.MEETUP_GUEST_JOINED) {
    const meetupId = notification.payload?.meetupId;
    if (!meetupId) {
      return null;
    }
    return {
      screen: 'MeetupDetailsScreen',
      params: { meetupId },
    };
  }

  if (notification.type === NOTIFICATION_TYPES.MEETUP_NEARBY) {
    const meetupId = notification.payload?.meetupId;
    if (!meetupId) {
      return null;
    }
    return {
      screen: 'MeetupDetailsScreen',
      params: { meetupId },
    };
  }

  if (notification.type === NOTIFICATION_TYPES.MEETUP_REMINDER) {
    const meetupId = notification.payload?.meetupId;
    if (!meetupId) {
      return null;
    }
    return {
      screen: 'MeetupDetailsScreen',
      params: { meetupId },
    };
  }

  return null;
}

export async function openAccountNotification({
  notification,
  navigation,
  setPet,
  markRead,
  dismissPermissionReminder,
}) {
  if (!notification) {
    return false;
  }

  const destination = getNotificationDestination(notification);
  if (!destination) {
    return false;
  }

  try {
    await markRead?.(notification.id);
  } catch (error) {
    // A transient read-state failure should not trap the user in the inbox.
    console.error('[NotificationNavigation] mark read', error);
  }

  if (notification.targetPetId && typeof setPet === 'function') {
    await setPet(String(notification.targetPetId));
  }

  navigation.navigate(destination.screen, destination.params);
  return true;
}
