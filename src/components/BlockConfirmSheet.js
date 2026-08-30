import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { blockPet } from '../services/blocks';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Quiet confirm sheet to block another pet profile.
 */
export default function BlockConfirmSheet({
  visible,
  pet,
  onClose,
  onBlocked,
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [done, setDone] = useState(false);

  const petName = String(pet?.name ?? '').trim() || 'this pet';

  const handleClose = useCallback(() => {
    if (busy) {
      return;
    }
    setErrorText('');
    setDone(false);
    onClose?.();
  }, [busy, onClose]);

  const handleConfirm = useCallback(async () => {
    const petId = String(pet?.id ?? '');
    if (!petId || busy) {
      return;
    }
    if (!UUID_RE.test(petId)) {
      setErrorText('This pet cannot be blocked.');
      return;
    }
    setBusy(true);
    setErrorText('');
    try {
      await blockPet(petId);
      setDone(true);
      onBlocked?.(pet);
    } catch (e) {
      console.error('[BlockConfirmSheet]', e);
      setErrorText('Could not block right now.');
    } finally {
      setBusy(false);
    }
  }, [busy, onBlocked, pet]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.handle} />
        <Text style={styles.title} allowFontScaling>
          {done ? 'Blocked' : 'Block'}
        </Text>
        <Text style={styles.body} allowFontScaling>
          {done
            ? `${petName} won’t show in your feed.`
            : `Hide ${petName} from your feed. You can undo this in Settings.`}
        </Text>
        {errorText ? (
          <Text style={styles.errorText} allowFontScaling>
            {errorText}
          </Text>
        ) : null}
        {done ? (
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.primaryBtnText} allowFontScaling>
              Done
            </Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              disabled={busy}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.secondaryBtnText} allowFontScaling>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryBtn,
                busy && styles.primaryBtnDisabled,
                pressed && !busy && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Block ${petName}`}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.text.inverse.value} />
              ) : (
                <Text style={styles.primaryBtnText} allowFontScaling>
                  Block
                </Text>
              )}
            </Pressable>
          </View>
        )}
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
    marginBottom: 8,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.light,
  },
  secondaryBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand.sage.value,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.inverse.value,
  },
  errorText: {
    marginBottom: 12,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
