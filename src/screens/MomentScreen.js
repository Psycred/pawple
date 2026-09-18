import { Feather } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
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
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

const ICON_COLOR = '#6D8B74';
const CHEVRON_COLOR = '#A8A8A8';

function CreateOption({ icon, label, onPress, accessibilityLabel, surfaces }) {
  const optionTheme = useMemo(
    () => ({
      card: {
        backgroundColor: surfaces.createHubSheetBackground,
        borderColor: surfaces.createHubOptionBorder,
      },
      iconCircle: { backgroundColor: surfaces.createHubIconCircleBackground },
      label: { color: surfaces.textPrimary },
    }),
    [surfaces],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.optionCard, optionTheme.card, pressed && styles.optionPressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.optionRow}>
        <View style={[styles.optionIconWrap, optionTheme.iconCircle]}>
          <Feather name={icon} size={22} color={ICON_COLOR} />
        </View>
        <Text style={[styles.optionLabel, optionTheme.label]} allowFontScaling>
          {label}
        </Text>
        <Feather name="chevron-right" size={22} color={CHEVRON_COLOR} />
      </View>
    </Pressable>
  );
}

/**
 * “+” tab: calm creation hub with an iOS-style bottom sheet.
 * Capture a moment or plan a meetup; Cancel returns to Feed.
 */
export default function MomentHubScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const surfaces = useRuntimeThemeColors();
  const sheetTheme = useMemo(
    () => ({
      root: { backgroundColor: surfaces.backgroundScreen },
      sheet: { backgroundColor: surfaces.createHubSheetBackground },
      handle: { backgroundColor: surfaces.border },
      title: { color: surfaces.textPrimary },
      divider: { backgroundColor: surfaces.border },
      cancel: { color: surfaces.textMuted },
    }),
    [surfaces],
  );

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
    <View style={[styles.root, sheetTheme.root]} accessibilityLabel="Create">
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
              sheetTheme.sheet,
              {
                paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
              },
            ]}
          >
            <View style={[styles.handle, sheetTheme.handle]} importantForAccessibility="no" />

            <Text
              style={[styles.sheetTitle, sheetTheme.title]}
              accessibilityRole="header"
              allowFontScaling
            >
              Create
            </Text>

            <CreateOption
              icon="camera"
              label="Moment"
              onPress={openMoment}
              accessibilityLabel="Create a moment"
              surfaces={surfaces}
            />

            <CreateOption
              icon="calendar"
              label="Meetup"
              onPress={openMeetup}
              accessibilityLabel="Create a meetup"
              surfaces={surfaces}
            />

            <View style={[styles.cancelDivider, sheetTheme.divider]} />

            <Pressable
              onPress={goToFeed}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelPressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelLabel, sheetTheme.cancel]} allowFontScaling>
                Cancel
              </Text>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: theme.components.bottomSheet.handleWidth,
    height: theme.components.bottomSheet.handleHeight,
    borderRadius: theme.components.bottomSheet.handleRadius,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.lg,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 12,
    minHeight: 76,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  optionPressed: {
    opacity: theme.opacity.pressedUi,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
    lineHeight: 24,
  },
  cancelDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 4,
  },
  cancelBtn: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelPressed: {
    opacity: theme.opacity.pressedUi,
  },
  cancelLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    textAlign: 'center',
  },
});
