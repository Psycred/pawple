import React from 'react';
import { StyleSheet, View } from 'react-native';
import PawpleStorageImage from './PawpleStorageImage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../config/theme';

/**
 * Minimal paw-shaped profile header.
 * Center pad shows the pet photo, while toes stay as clean placeholders for future actions.
 */
export default function PawHeader({ photoUri }) {
  return (
    <View style={styles.container}>
      <View style={[styles.toe, styles.toeTopLeft]} />
      <View style={[styles.toe, styles.toeTopRight]} />
      <View style={[styles.toe, styles.toeBottomLeft]} />
      <View style={[styles.toe, styles.toeBottomRight]} />

      <View style={styles.centerPad}>
        {photoUri ? (
          <PawpleStorageImage source={{ uri: photoUri }} style={styles.centerImage} />
        ) : (
          <View style={styles.centerFallback}>
            <MaterialCommunityIcons name="paw" size={40} color={theme.colors.primary.dark} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toe: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.card.light,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    zIndex: 1,
  },
  toeTopLeft: {
    top: 0,
    left: 20,
  },
  toeTopRight: {
    top: 0,
    right: 20,
  },
  toeBottomLeft: {
    bottom: 0,
    left: 0,
  },
  toeBottomRight: {
    bottom: 0,
    right: 0,
  },
  centerPad: {
    position: 'absolute',
    bottom: 30,
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.background.light,
    backgroundColor: theme.colors.card.light,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...theme.shadowsRN.sm,
  },
  centerImage: {
    width: '100%',
    height: '100%',
  },
  centerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary.light,
  },
});
