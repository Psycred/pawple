import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { theme } from '../config/theme';
import { HEADER_ICON_TARGET, HEADER_MIN_HEIGHT, SCREEN_HORIZONTAL_PADDING } from '../utils/layout';

/**
 * Standardized screen shell for consistent safe-area + header handling.
 *
 * ALL new screens should use this instead of a hand-rolled SafeAreaView + header.
 * The header (close/back button + optional title + optional right slot) always sits
 * BELOW the status bar / notch via safe-area insets, on both iOS and Android.
 *
 * @param {object} props
 * @param {string}   [props.title]           Centered header title (Inter SemiBold).
 * @param {boolean}  [props.showBackButton]  Render a back chevron instead of an "X".
 * @param {Function} [props.onClose]         Dismiss handler; also shows the left button.
 * @param {React.ReactNode} [props.headerRight] Optional right-aligned header content.
 * @param {object}   [props.titleStyle]      Optional override for header title typography.
 * @param {React.ReactNode} props.children   Screen body.
 * @param {string[]} [props.edges]           Safe-area edges (default top + bottom).
 * @param {boolean}  [props.padded]          Apply standard horizontal padding to the body.
 * @param {string}   [props.backgroundColor] Screen + status bar background.
 * @param {'dark-content'|'light-content'} [props.statusBarStyle]
 * @param {object}   [props.contentStyle]    Extra style for the body container.
 * @param {object}   [props.titleStyle]      Optional override for header title typography.
 */
export default function ScreenWrapper({
  title,
  showBackButton = false,
  onClose,
  headerRight = null,
  titleStyle = null,
  children,
  edges = ['top', 'bottom'],
  padded = false,
  backgroundColor = theme.colors.background.screen,
  statusBarStyle = 'dark-content',
  contentStyle,
}) {
  const showLeftButton = typeof onClose === 'function';
  const showHeader = showLeftButton || Boolean(title) || Boolean(headerRight);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={edges}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} translucent={false} />

      {showHeader ? (
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {showLeftButton ? (
              <Pressable
                onPress={onClose}
                hitSlop={theme.spacing.sm}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={showBackButton ? 'Go back' : 'Close'}
              >
                <Feather
                  name={showBackButton ? 'chevron-left' : 'x'}
                  size={theme.fontSizes.xxl}
                  color={theme.colors.text.primary.light}
                />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.headerCenter}>
            {title ? (
              <Text style={[styles.headerTitle, titleStyle]} numberOfLines={1} allowFontScaling>
                {title}
              </Text>
            ) : null}
          </View>

          <View style={[styles.headerSide, styles.headerRight]}>{headerRight}</View>
        </View>
      ) : null}

      <View style={[styles.content, padded && styles.contentPadded, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  header: {
    minHeight: HEADER_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  headerSide: {
    minWidth: HEADER_ICON_TARGET,
    justifyContent: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
  },
  iconButton: {
    width: HEADER_ICON_TARGET,
    height: HEADER_ICON_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  content: {
    flex: 1,
  },
  contentPadded: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
});
