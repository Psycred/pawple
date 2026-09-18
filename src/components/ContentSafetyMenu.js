import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

/**
 * Quiet first-step menu: Report / Block — progressive disclosure for safety.
 */
export default function ContentSafetyMenu({
  visible,
  title = 'Safety',
  showEdit = false,
  showDelete = false,
  showReport = true,
  showBlock = false,
  showUnpaw = false,
  showViewProfile = false,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  blockLabel = 'Block pet',
  unpawLabel = 'Unpaw',
  viewProfileLabel = 'View Profile',
  onEdit,
  onDelete,
  onReport,
  onBlock,
  onUnpaw,
  onViewProfile,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const surfaces = useRuntimeThemeColors();

  const rowStyle = ({ pressed }) => [
    styles.row,
    { backgroundColor: surfaces.backgroundScreen },
    pressed && styles.pressed,
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: surfaces.backgroundElevated,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: surfaces.border }]} />
        <Text style={[styles.title, { color: surfaces.textPrimary }]} allowFontScaling>
          {title}
        </Text>
        {showEdit ? (
          <Pressable
            onPress={onEdit}
            style={rowStyle}
            accessibilityRole="button"
            accessibilityLabel={editLabel}
          >
            <Text style={[styles.rowText, { color: surfaces.textPrimary }]} allowFontScaling>
              {editLabel}
            </Text>
          </Pressable>
        ) : null}
        {showDelete ? (
          <Pressable
            onPress={onDelete}
            style={rowStyle}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
          >
            <Text style={[styles.rowText, styles.destructiveText]} allowFontScaling>
              {deleteLabel}
            </Text>
          </Pressable>
        ) : null}
        {showViewProfile ? (
          <Pressable
            onPress={onViewProfile}
            style={rowStyle}
            accessibilityRole="button"
            accessibilityLabel={viewProfileLabel}
          >
            <Text style={[styles.rowText, { color: surfaces.textPrimary }]} allowFontScaling>
              {viewProfileLabel}
            </Text>
          </Pressable>
        ) : null}
        {showUnpaw ? (
          <Pressable
            onPress={onUnpaw}
            style={rowStyle}
            accessibilityRole="button"
            accessibilityLabel={unpawLabel}
          >
            <Text style={[styles.rowText, { color: surfaces.textPrimary }]} allowFontScaling>
              {unpawLabel}
            </Text>
          </Pressable>
        ) : null}
        {showReport ? (
          <Pressable
            onPress={onReport}
            style={rowStyle}
            accessibilityRole="button"
            accessibilityLabel="Report"
          >
            <Text style={[styles.rowText, { color: surfaces.textPrimary }]} allowFontScaling>
              Report
            </Text>
          </Pressable>
        ) : null}
        {showBlock ? (
          <Pressable
            onPress={onBlock}
            style={rowStyle}
            accessibilityRole="button"
            accessibilityLabel={blockLabel}
          >
            <Text style={[styles.rowText, { color: surfaces.textPrimary }]} allowFontScaling>
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
          <Text style={[styles.cancelText, { color: surfaces.textSecondary }]} allowFontScaling>
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
    marginBottom: 16,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
    marginBottom: 12,
  },
  row: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 8,
  },
  rowText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
  },
  destructiveText: {
    color: theme.colors.feedback.error.value,
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
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
