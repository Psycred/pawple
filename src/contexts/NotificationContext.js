import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { presentForegroundPushFallback } from '../lib/pushNotifications';
import { useAuth } from './AuthContext';
import {
  fetchAccountNotifications,
  fetchUnreadNotificationCount,
  markAccountNotificationRead,
  normalizeAccountNotification,
  subscribeToAccountNotifications,
} from '../services/accountNotifications';
import {
  snoozePermissionReminder,
  syncPermissionReminders,
} from '../services/permissionReminders';
import { isPermissionReminderType } from '../lib/permissionReminderScheduler';

const NotificationContext = createContext(null);

function mergeUniqueNotifications(current, incoming) {
  const byId = new Map(current.map((item) => [String(item.id), item]));
  incoming.forEach((item) => {
    byId.set(String(item.id), item);
  });
  return [...byId.values()].sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();
    return bTime - aTime;
  });
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [localPermissionReminders, setLocalPermissionReminders] = useState([]);
  const notificationIdsRef = useRef(new Set());

  const syncLocalPermissionReminders = useCallback(async () => {
    if (!user?.id) {
      setLocalPermissionReminders([]);
      return [];
    }

    try {
      const reminders = await syncPermissionReminders(user.id);
      setLocalPermissionReminders(reminders);
      return reminders;
    } catch (syncError) {
      console.error('[NotificationContext] permission reminders', syncError);
      return [];
    }
  }, [user?.id]);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!user?.id) {
      notificationIdsRef.current = new Set();
      setNotifications([]);
      setLocalPermissionReminders([]);
      setUnreadCount(0);
      setPage(0);
      setHasMore(false);
      setError(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(false);

    try {
      const [pageResult, nextUnreadCount, localReminders] = await Promise.all([
        fetchAccountNotifications({ page: 0 }),
        fetchUnreadNotificationCount(),
        syncPermissionReminders(user.id),
      ]);
      notificationIdsRef.current = new Set(
        pageResult.notifications.map((item) => String(item.id)),
      );
      setNotifications(pageResult.notifications);
      setLocalPermissionReminders(localReminders);
      const localUnread = localReminders.filter((item) => !item.isRead).length;
      setUnreadCount(nextUnreadCount + localUnread);
      setPage(0);
      setHasMore(pageResult.hasMore);
    } catch (loadError) {
      console.error('[NotificationContext] refresh', loadError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const mergedNotifications = useMemo(
    () => mergeUniqueNotifications(localPermissionReminders, notifications),
    [localPermissionReminders, notifications],
  );

  const loadMore = useCallback(async () => {
    if (!user?.id || !hasMore || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const pageResult = await fetchAccountNotifications({ page: nextPage });
      pageResult.notifications.forEach((item) => {
        notificationIdsRef.current.add(String(item.id));
      });
      setNotifications((current) =>
        mergeUniqueNotifications(current, pageResult.notifications),
      );
      setPage(nextPage);
      setHasMore(pageResult.hasMore);
    } catch (loadError) {
      console.error('[NotificationContext] load more', loadError);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page, user?.id]);

  const dismissPermissionReminder = useCallback(
    async (notification) => {
      if (!user?.id || !notification?.type) {
        return;
      }
      await snoozePermissionReminder(user.id, notification.type);
      setLocalPermissionReminders((items) =>
        items.filter((item) => String(item.id) !== String(notification.id)),
      );
      if (!notification.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    },
    [user?.id],
  );

  const markRead = useCallback(async (notificationId) => {
    const current = mergedNotifications.find(
      (item) => String(item.id) === String(notificationId),
    );
    if (!current || current.isRead) {
      return current ?? null;
    }

    if (current.isLocal && isPermissionReminderType(current.type)) {
      await dismissPermissionReminder(current);
      return { ...current, isRead: true };
    }

    const optimisticReadAt = new Date().toISOString();
    setNotifications((items) =>
      items.map((item) =>
        String(item.id) === String(notificationId)
          ? { ...item, isRead: true, readAt: optimisticReadAt }
          : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      return await markAccountNotificationRead(notificationId);
    } catch (markError) {
      setNotifications((items) =>
        items.map((item) =>
          String(item.id) === String(notificationId) ? current : item,
        ),
      );
      setUnreadCount((count) => count + 1);
      throw markError;
    }
  }, [dismissPermissionReminder, mergedNotifications, notifications]);

  useEffect(() => {
    notificationIdsRef.current = new Set();
    setNotifications([]);
    setLocalPermissionReminders([]);
    setUnreadCount(0);
    setPage(0);
    setHasMore(false);
    setError(false);
    refresh();
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    return subscribeToAccountNotifications(user.id, (event) => {
      if (event.eventType === 'DELETE') {
        const removedId = event.old?.id;
        if (removedId) {
          notificationIdsRef.current.delete(String(removedId));
          setNotifications((items) =>
            items.filter((item) => String(item.id) !== String(removedId)),
          );
        }
        fetchUnreadNotificationCount()
          .then(setUnreadCount)
          .catch((countError) =>
            console.error('[NotificationContext] unread count', countError),
          );
        return;
      }

      const incoming = normalizeAccountNotification(event.new);
      if (!incoming) {
        return;
      }

      const incomingId = String(incoming.id);
      const existed = notificationIdsRef.current.has(incomingId);
      notificationIdsRef.current.add(incomingId);
      if (!existed && !incoming.isRead) {
        setUnreadCount((count) => count + 1);
      }
      setNotifications((items) => mergeUniqueNotifications(items, [incoming]));
      if (event.eventType === 'INSERT' && !incoming.isRead) {
        presentForegroundPushFallback(incoming).catch((pushError) =>
          console.log('[NotificationContext] push fallback skipped:', pushError?.message ?? pushError),
        );
      }
      if (event.eventType === 'UPDATE') {
        fetchUnreadNotificationCount()
          .then(setUnreadCount)
          .catch((countError) =>
            console.error('[NotificationContext] unread count', countError),
          );
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const handleForeground = () => {
      syncLocalPermissionReminders()
        .then((reminders) => {
          fetchUnreadNotificationCount()
            .then((serverUnread) => {
              const localUnread = reminders.filter((item) => !item.isRead).length;
              setUnreadCount(serverUnread + localUnread);
            })
            .catch((countError) =>
              console.error('[NotificationContext] unread count', countError),
            );
        })
        .catch((syncError) =>
          console.error('[NotificationContext] foreground reminders', syncError),
        );
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        handleForeground();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncLocalPermissionReminders, user?.id]);

  const value = useMemo(
    () => ({
      notifications: mergedNotifications,
      unreadCount,
      hasUnreadNotifications: unreadCount > 0,
      loading,
      refreshing,
      loadingMore,
      error,
      hasMore,
      refresh,
      loadMore,
      markRead,
      dismissPermissionReminder,
      syncLocalPermissionReminders,
    }),
    [
      dismissPermissionReminder,
      error,
      hasMore,
      loadMore,
      loading,
      loadingMore,
      markRead,
      mergedNotifications,
      refresh,
      refreshing,
      syncLocalPermissionReminders,
      unreadCount,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
