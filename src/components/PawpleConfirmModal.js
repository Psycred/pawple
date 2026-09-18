import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

const SAGE_CTA = '#9EB8A0';
const DANGER_CTA = '#E85D5D';
const ICON_CAUTION_COLOR = '#D96A6A';
const ICON_NEUTRAL_COLOR = '#6D8B74';

const ICON_TONE_COLORS = {
  caution: ICON_CAUTION_COLOR,
  neutral: ICON_NEUTRAL_COLOR,
};

/**
 * Pawple's centered confirmation card — calm, Apple-like, two clear choices.
 * Visual only; callers keep their own confirm/cancel logic.
 */
export default function PawpleConfirmModal({
  visible,
  busy = false,
  onClose,
  onConfirm,
  title,
  lead = null,
  body = null,
  errorText = null,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  icon = 'alert-circle',
  showIcon = true,
  iconTone = 'caution',
  confirmTone = 'sage',
  mode = 'confirm',
}) {
  const surfaces = useRuntimeThemeColors();
  const iconColor = ICON_TONE_COLORS[iconTone] ?? ICON_TONE_COLORS.caution;
  const iconCircleBg =
    iconTone === 'neutral'
      ? surfaces.createHubIconCircleBackground
      : surfaces.confirmIconCautionBackground;
  const confirmBg = confirmTone === 'danger' ? DANGER_CTA : SAGE_CTA;
  const isSingleAction = mode === 'single';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={busy ? undefined : onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />

        <View
          style={[styles.card, { backgroundColor: surfaces.createHubSheetBackground }]}
          accessibilityViewIsModal
          accessible
        >
          {showIcon ? (
            <View style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}>
              <Feather name={icon} size={24} color={iconColor} />
            </View>
          ) : null}

          <Text style={[styles.title, { color: surfaces.textPrimary }]} allowFontScaling>
            {title}
          </Text>

          {lead ? (
            <Text style={[styles.lead, { color: surfaces.textPrimary }]} allowFontScaling>
              {lead}
            </Text>
          ) : null}

          {body ? (
            <Text
              style={[
                styles.body,
                !lead && styles.bodyWithoutLead,
                { color: surfaces.textMuted },
              ]}
              allowFontScaling
            >
              {body}
            </Text>
          ) : null}

          {errorText ? (
            <Text style={styles.errorText} allowFontScaling>
              {errorText}
            </Text>
          ) : null}

          {isSingleAction ? (
            <Pressable
              onPress={onConfirm ?? onClose}
              disabled={busy}
              style={({ pressed }) => [
                styles.confirmButton,
                styles.singleButton,
                { backgroundColor: confirmBg },
                pressed && !busy && styles.pressed,
                busy && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText} allowFontScaling>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                disabled={busy}
                style={({ pressed }) => [
                  styles.cancelButton,
                  { backgroundColor: surfaces.confirmModalCancelBackground },
                  pressed && !busy && styles.pressed,
                  busy && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
              >
                <Text style={[styles.cancelButtonText, { color: surfaces.textSecondary }]} allowFontScaling>
                  {cancelLabel}
                </Text>
              </Pressable>

              <Pressable
                onPress={onConfirm}
                disabled={busy}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: confirmBg },
                  pressed && !busy && styles.pressed,
                  busy && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText} allowFontScaling>
                    {confirmLabel}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.components.bottomSheet.backdrop,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 8,
  },
  lead: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  bodyWithoutLead: {
    marginTop: 2,
  },
  errorText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: 18,
    color: theme.colors.feedback.error.value,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
  },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  singleButton: {
    width: '100%',
    flex: 0,
    alignSelf: 'stretch',
  },
  confirmButtonText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
  disabled: {
    opacity: 0.7,
  },
});
