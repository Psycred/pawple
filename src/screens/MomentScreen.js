import { useIsFocused, useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '../navigation/navigationRef';
import { theme } from '../config/theme';

/**
 * “+” tab: calm creation hub with an iOS-style bottom sheet.
 * Capture a moment or plan a meetup; Cancel returns to Feed.
 */
export default function MomentHubScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const goToFeed = () => {
    navigation.navigate('FeedScreen');
  };

  const openMoment = () => {
    // Create screens live on root stack, not on the tab navigator — use ref + switch tab so sheet dismisses.
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs', { screen: 'FeedScreen' });
      navigationRef.navigate('CreateMomentScreen');
      return;
    }
    const stack = navigation.getParent()?.getParent();
    navigation.navigate('FeedScreen');
    stack?.navigate('CreateMomentScreen');
  };

  const openMeetup = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs', { screen: 'FeedScreen' });
      navigationRef.navigate('CreateMeetupScreen');
      return;
    }
    const stack = navigation.getParent()?.getParent();
    navigation.navigate('FeedScreen');
    stack?.navigate('CreateMeetupScreen');
  };

  return (
    <View style={styles.root} accessibilityLabel="Create">
      <Modal
        visible={isFocused}
        animationType="slide"
        transparent
        onRequestClose={goToFeed}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdropPress}
            onPress={goToFeed}
            accessibilityLabel="Dismiss create menu"
            accessibilityRole="button"
          >
            <View style={styles.backdropFill} />
          </Pressable>

          <View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, theme.spacing.xxl),
              },
            ]}
          >
            <View style={styles.handle} importantForAccessibility="no" />

            <Text style={[theme.fonts.h2, styles.sheetTitle]} accessibilityRole="header">
              Create
            </Text>

            <Pressable
              onPress={openMoment}
              style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
              accessibilityRole="button"
              accessibilityLabel="Capture a moment"
            >
              <Text style={[theme.fonts.bodySemibold, styles.optionTitle]} allowFontScaling>
                🐾 Capture a moment
              </Text>
              <Text style={styles.optionSubtitle}>Save a quiet memory with your pet</Text>
            </Pressable>

            <Pressable
              onPress={openMeetup}
              style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
              accessibilityRole="button"
              accessibilityLabel="Plan a meetup"
            >
              <Text style={[theme.fonts.bodySemibold, styles.optionTitle]} allowFontScaling>
                📍 Plan a meetup
              </Text>
              <Text style={styles.optionSubtitle}>Invite nearby paws for a gentle gathering</Text>
            </Pressable>

            <Pressable
              onPress={goToFeed}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelPressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    flex: 1,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  sheet: {
    backgroundColor: theme.colors.background.screen,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.lg + theme.spacing.xs,
    paddingTop: theme.spacing.lg,
    ...theme.shadowsRN.sm,
  },
  handle: {
    width: theme.components.bottomSheet.handleWidth,
    height: theme.components.bottomSheet.handleHeight,
    borderRadius: theme.components.bottomSheet.handleRadius,
    backgroundColor: theme.colors.border.light,
    alignSelf: 'center',
    marginBottom: theme.spacing.xl,
  },
  sheetTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    color: theme.colors.text.primary.light,
  },
  optionCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg + theme.spacing.xs / 2,
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    minHeight: theme.components.button.minHeight,
  },
  optionPressed: {
    opacity: 0.92,
  },
  optionTitle: {
    color: theme.colors.text.primary.light,
  },
  optionSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.fontSizes.sm * theme.lineHeights.normal,
    color: theme.colors.text.muted.light,
    marginTop: theme.spacing.xs,
  },
  cancelBtn: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: theme.components.button.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: {
    opacity: 0.8,
  },
  cancelLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    textAlign: 'center',
  },
});
