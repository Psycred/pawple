import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import PawpleStorageImage from './PawpleStorageImage';
import { theme } from '../config/theme';

const SIZE = theme.pawPhotoFrame.photoDiameter;
const RADIUS = SIZE / 2;
const ICON_SIZE = theme.spacing.xl;
const BORDER_WIDTH = 2;

/**
 * Circular pet photo picker — dashed placeholder or filled image.
 * @param {{ uri?: string | null, onPress: () => void, disabled?: boolean, validating?: boolean }} props
 */
export default function PawPhotoFrame({ uri, onPress, disabled = false, validating = false }) {
  const hasPhoto = Boolean(uri);
  const isDisabled = disabled || validating;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.hit,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={hasPhoto ? 'Change pet photo' : 'Add pet photo'}
      accessibilityState={{ disabled: isDisabled, busy: validating }}
    >
      <View style={[styles.ring, hasPhoto && styles.ringFilled]}>
        {validating ? (
          <ActivityIndicator color={theme.colors.primary.light} />
        ) : hasPhoto ? (
          <PawpleStorageImage
            source={{ uri }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Feather
            name="camera"
            size={ICON_SIZE}
            color={theme.colors.placeholder.value}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    borderWidth: BORDER_WIDTH,
    borderStyle: 'dashed',
    borderColor: theme.colors.text.muted.light,
    backgroundColor: theme.colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringFilled: {
    borderStyle: 'solid',
    borderColor: theme.colors.border.light,
  },
  photo: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  disabled: {
    opacity: theme.opacity.pressedUi,
  },
});
