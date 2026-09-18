import { supabase } from '../config/supabase';
import {
  collectMeetupReminderIds,
  filterActiveMeetupReminderNotifications,
} from '../lib/meetupReminderNotifications';

export const NOTIFICATION_PAGE_SIZE = 30;

export function normalizeAccountNotification(row) {
  if (!row?.id) {
    return null;
  }

  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    fromUserId: row.from_user_id ? String(row.from_user_id) : null,
    type: row.type ?? '',
    eventKey: row.event_key ?? null,
    targetPetId: row.target_pet_id ? String(row.target_pet_id) : null,
    actorPetId: row.actor_pet_id ? String(row.actor_pet_id) : null,
    pawInterestId: row.paw_interest_id ? String(row.paw_interest_id) : null,
    channelId: row.channel_id ? String(row.channel_id) : null,
    messageId: row.message_id ? String(row.message_id) : null,
    title: row.title?.trim() || 'Pawple',
    body: row.body?.trim() || '',
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    isRead: Boolean(row.is_read || row.read_at),
    readAt: row.read_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function fetchAccountNotifications({ page = 0, pageSize = NOTIFICATION_PAGE_SIZE } = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { notifications: [], hasMore: false };
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, user_id, from_user_id, type, event_key, target_pet_id, actor_pet_id, paw_interest_id, channel_id, message_id, title, body, payload, is_read, read_at, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  let notifications = (data ?? [])
    .map(normalizeAccountNotification)
    .filter(Boolean);

  const meetupIds = collectMeetupReminderIds(notifications);
  if (meetupIds.length) {
    const { data: meetups, error: meetupError } = await supabase
      .from('meetups')
      .select('id, status, date, start_time, end_time')
      .in('id', meetupIds);

    if (meetupError) {
      console.error('[Supabase]', meetupError);
    } else {
      notifications = filterActiveMeetupReminderNotifications(notifications, meetups ?? []);
    }
  }

  return {
    notifications,
    hasMore: notifications.length === pageSize,
  };
}

export async function fetchUnreadNotificationCount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return 0;
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, payload, read_at')
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  const unreadRows = (data ?? []).map((row) => normalizeAccountNotification(row)).filter(Boolean);
  const meetupIds = collectMeetupReminderIds(unreadRows);

  if (!meetupIds.length) {
    return unreadRows.length;
  }

  const { data: meetups, error: meetupError } = await supabase
    .from('meetups')
    .select('id, status, date, start_time, end_time')
    .in('id', meetupIds);

  if (meetupError) {
    console.error('[Supabase]', meetupError);
    return unreadRows.length;
  }

  return filterActiveMeetupReminderNotifications(unreadRows, meetups ?? []).length;
}

export async function markAccountNotificationRead(notificationId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !notificationId) {
    return null;
  }

  const readAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: readAt })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .select(
      'id, user_id, from_user_id, type, event_key, target_pet_id, actor_pet_id, paw_interest_id, channel_id, message_id, title, body, payload, is_read, read_at, created_at',
    )
    .maybeSingle();

  if (error) {
    console.error('[Supabase]', error);
    throw error;
  }

  return normalizeAccountNotification(data);
}

export function subscribeToAccountNotifications(userId, onChange) {
  if (!userId || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel(`account-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
