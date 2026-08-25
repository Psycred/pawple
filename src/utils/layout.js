import { Platform, StatusBar } from 'react-native';

/**
 * Shared layout constants for consistent safe-area + header handling.
 * Prefer these (and the ScreenWrapper) over hand-rolled values so every screen
 * stays aligned with the design system.
 */

/** Android status bar height. iOS status bar is handled by safe-area insets. */
export const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20;

/** Consistent header row height across screens. */
export const HEADER_MIN_HEIGHT = 56;

/** Default screen horizontal padding (matches the feed shell gutter). */
export const SCREEN_HORIZONTAL_PADDING = 20;

/** Standard touch target for header icon buttons. */
export const HEADER_ICON_TARGET = 44;
