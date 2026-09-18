import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import PawpleStorageImage from './PawpleStorageImage';
import { theme } from '../config/theme';

const { avatarBorderWidth } = theme.feed;

/**
 * Pet avatar for context bar / switcher. Pass `photoUrl` or `photo_url` from Supabase.
 * When null/empty: soft green circle + paw icon (never a blank circle).
 */
export default function PetContextSelector({ photoUrl, photo_url, size = 40, style, imageStyle, testID }) {
  const raw = photoUrl ?? photo_url;
  const uri = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  const dim = size;
  const radius = dim / 2;
  const ink = theme.components.button.primaryText;

  if (uri) {
    return (
      <PawpleStorageImage
        testID={testID}
        source={{ uri }}
        style={[
          styles.base,
          {
            width: dim,
            height: dim,
            borderRadius: radius,
          },
          style,
          imageStyle,
        ]}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        styles.fallback,
        {
          width: dim,
          height: dim,
          borderRadius: radius,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Pet avatar, no photo yet"
    >
      <Ionicons name="paw" size={dim * 0.48} color={ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: avatarBorderWidth,
    borderColor: '#FFFFFF',
  },
  fallback: {
    backgroundColor: theme.colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
