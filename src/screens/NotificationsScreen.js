import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LoadErrorRetry from '../components/LoadErrorRetry';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { useActivePet } from '../contexts/ActivePetContext';
import { useNotifications } from '../contexts/NotificationContext';
import PermissionReminderRow from '../components/PermissionReminderRow';
import { NOTIFICATION_TYPES } from '../constants/accountNotifications';
import { isPermissionReminderType } from '../lib/permissionReminderScheduler';
import { openAccountNotification } from '../lib/notificationNavigation';

function formatNotificationTime(value) {
  const date = new Date(value ?? 0);
  const elapsedMs = Date.now() - date.getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return '';
  }

  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NotificationIcon({ type, unread }) {
  const color = unread
    ? theme.colors.brand.sageDark.value
    : theme.colors.text.muted.light;

  if (
    type === NOTIFICATION_TYPES.PAW_RECEIVED ||
    type === NOTIFICATION_TYPES.PAW_RESPONSE
  ) {
    return <Ionicons name="paw-outline" size={20} color={color} />;
  }
  if (type === NOTIFICATION_TYPES.CHAT_MESSAGE) {
    return <Feather name="message-circle" size={20} color={color} />;
  }
  if (
    type === NOTIFICATION_TYPES.PERMISSION_REMINDER_LOCATION ||
    type === NOTIFICATION_TYPES.PERMISSION_REMINDER_NOTIFICATIONS
  ) {
    return <Feather name="map-pin" size={20} color={color} />;
  }
  if (
    type === NOTIFICATION_TYPES.MEETUP_GUEST_JOINED ||
    type === NOTIFICATION_TYPES.MEETUP_NEARBY ||
    type === NOTIFICATION_TYPES.MEETUP_REMINDER
  ) {
    return <Feather name="calendar" size={20} color={color} />;
  }
  return <Feather name="bell" size={20} color={color} />;
}

export default function NotificationsScreen({ navigation }) {
  const surfaces = useRuntimeThemeColors();
  const { setPet } = useActivePet();
  const {
    notifications,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    markRead,
    dismissPermissionReminder,
  } = useNotifications();

  const notificationsTheme = useMemo(
    () => ({
      row: { backgroundColor: surfaces.backgroundCard },
      rowUnread: {
        backgroundColor: surfaces.isDark
          ? surfaces.meetupChipBackground
          : theme.colors.brand.sageLight.light,
      },
      rowIcon: { backgroundColor: surfaces.backgroundScreen },
      rowIconUnread: { backgroundColor: surfaces.backgroundCard },
      rowTitle: { color: surfaces.textSecondary },
      rowTitleUnread: { color: surfaces.textPrimary },
      rowBody: { color: surfaces.textSecondary },
      rowTime: { color: surfaces.textMuted },
      emptyIconWrap: { backgroundColor: surfaces.backgroundCard },
      emptyTitle: { color: surfaces.textPrimary },
      emptyBody: { color: surfaces.textMuted },
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.isDark,
      surfaces.meetupChipBackground,
      surfaces.textMuted,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

  const handleNotificationPress = useCallback(
    (notification) =>
      openAccountNotification({
        notification,
        navigation,
        setPet,
        markRead,
        dismissPermissionReminder,
      }),
    [dismissPermissionReminder, markRead, navigation, setPet],
  );

  const renderNotification = useCallback(
    ({ item }) => {
      if (isPermissionReminderType(item.type)) {
        return (
          <PermissionReminderRow
            body={item.body}
            iconName={
              item.type === NOTIFICATION_TYPES.PERMISSION_REMINDER_NOTIFICATIONS
                ? 'bell'
                : 'map-pin'
            }
            onOk={() => handleNotificationPress(item)}
            onNotNow={() => dismissPermissionReminder(item)}
          />
        );
      }

      const unread = !item.isRead;
      const timestamp = formatNotificationTime(item.createdAt);
      return (
        <Pressable
          onPress={() => handleNotificationPress(item)}
          style={({ pressed }) => [
            styles.notificationRow,
            notificationsTheme.row,
            unread && notificationsTheme.rowUnread,
            pressed && styles.notificationRowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}${item.body ? `. ${item.body}` : ''}`}
        >
          <View
            style={[
              styles.rowIcon,
              notificationsTheme.rowIcon,
              unread && notificationsTheme.rowIconUnread,
            ]}
          >
            <NotificationIcon type={item.type} unread={unread} />
          </View>
          <View style={styles.rowCopy}>
            <Text
              style={[
                styles.rowTitle,
                notificationsTheme.rowTitle,
                unread && notificationsTheme.rowTitleUnread,
              ]}
              numberOfLines={2}
              allowFontScaling
            >
              {item.title}
            </Text>
            {item.body ? (
              <Text
                style={[styles.rowBody, notificationsTheme.rowBody]}
                numberOfLines={2}
                allowFontScaling
              >
                {item.body}
              </Text>
            ) : null}
            {timestamp ? (
              <Text style={[styles.rowTime, notificationsTheme.rowTime]} allowFontScaling>
                {timestamp}
              </Text>
            ) : null}
          </View>
          {unread ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      );
    },
    [dismissPermissionReminder, handleNotificationPress, notificationsTheme],
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.brand.sage.value} />
        </View>
      );
    }
    if (error) {
      return <LoadErrorRetry onRetry={() => refresh()} style={styles.centerState} />;
    }
    return (
      <View style={styles.centerState}>
        <View style={[styles.emptyIconWrap, notificationsTheme.emptyIconWrap]}>
          <Ionicons
            name="paw-outline"
            size={24}
            color={theme.colors.text.muted.light}
          />
        </View>
        <Text style={[styles.emptyTitle, notificationsTheme.emptyTitle]} allowFontScaling>
          You&apos;re all caught up
        </Text>
        <Text style={[styles.emptyBody, notificationsTheme.emptyBody]} allowFontScaling>
          Quiet for now. New paws and messages will appear here.
        </Text>
      </View>
    );
  };

  return (
    <ScreenWrapper
      title="Notifications"
      showBackButton
      onClose={() => navigation.goBack()}
    >
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNotification}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={theme.colors.brand.sage.value}
              style={styles.footerLoader}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh({ quiet: true })}
            tintColor={theme.colors.brand.sage.value}
            colors={[theme.colors.brand.sage.value]}
          />
        }
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  listContentEmpty: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: theme.spacing.xl,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.card,
  },
  emptyTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  emptyBody: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
  notificationRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.card,
  },
  notificationRowUnread: {
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  notificationRowPressed: {
    opacity: theme.opacity.pressedUi,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.background.screen,
  },
  rowIconUnread: {
    backgroundColor: theme.colors.background.card,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
  },
  rowTitleUnread: {
    color: theme.colors.text.primary.light,
  },
  rowBody: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
  },
  rowTime: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
  },
  unreadDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
    borderRadius: theme.spacing.sm / 2,
    backgroundColor: theme.colors.brand.sage.value,
  },
  footerLoader: {
    paddingVertical: theme.spacing.md,
  },
});
