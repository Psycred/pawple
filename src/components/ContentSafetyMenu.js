import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';

/**
 * Quiet first-step menu: Report / Block — progressive disclosure for safety.
 */
export default function ContentSafetyMenu({
  visible,
  title = 'Safety',
  showReport = true,
  showBlock = false,
  blockLabel = 'Block pet',
  onReport,
  onBlock,
  onClose,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.handle} />
        <Text style={styles.title} allowFontScaling>
          {title}
        </Text>
        {showReport ? (
          <Pressable
            onPress={onReport}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Report"
          >
            <Text style={styles.rowText} allowFontScaling>
              Report
            </Text>
          </Pressable>
        ) : null}
        {showBlock ? (
          <Pressable
            onPress={onBlock}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={blockLabel}
          >
            <Text style={styles.rowText} allowFontScaling>
              {blockLabel}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.cancelRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText} allowFontScaling>
            Cancel
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  sheet: {
    backgroundColor: theme.colors.background.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: theme.components.bottomSheet.handleWidth || 40,
    height: theme.components.bottomSheet.handleHeight || 4,
    borderRadius: theme.components.bottomSheet.handleRadius || 2,
    backgroundColor: theme.colors.border.light,
    marginBottom: 16,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text.primary.light,
    marginBottom: 12,
  },
  row: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: theme.colors.background.light,
    marginBottom: 8,
  },
  rowText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  cancelRow: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
