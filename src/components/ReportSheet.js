import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { supabase } from '../config/supabase';
import { useActivePet } from '../contexts/ActivePetContext';
import { blockPet } from '../services/blocks';
import { createReport, REPORT_REASONS } from '../services/reports';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Calm progressive report sheet for Moments and Meetups.
 * Reports are filed as the active (or first) pet; flags the human account.
 * Mating-session reports are deferred — note only, no mating UI.
 *
 * @param {'moment'|'meetup'} targetType
 * @param {{ id: string, name?: string }[]} [blockablePets] other pets on the content
 */
export default function ReportSheet({
  visible,
  targetType,
  targetId,
  reportedUserId,
  blockablePets = [],
  onClose,
  onSubmitted,
  onBlocked,
}) {
  const insets = useSafeAreaInsets();
  const { activePetId } = useActivePet();

  const [step, setStep] = useState('reason'); // reason | details | done
  const [reasonId, setReasonId] = useState(null);
  const [details, setDetails] = useState('');
  const [reporterPet, setReporterPet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [blockBusyId, setBlockBusyId] = useState(null);

  const reasonLabel = useMemo(
    () => REPORT_REASONS.find((r) => r.id === reasonId)?.label ?? '',
    [reasonId],
  );

  const canPersist = useMemo(() => {
    return (
      UUID_RE.test(String(targetId ?? '')) &&
      UUID_RE.test(String(reportedUserId ?? ''))
    );
  }, [reportedUserId, targetId]);

  const reset = useCallback(() => {
    setStep('reason');
    setReasonId(null);
    setDetails('');
    setBusy(false);
    setErrorText('');
    setBlockBusyId(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      reset();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id || cancelled) {
          return;
        }
        const { data, error } = await supabase
          .from('pets')
          .select('id, name')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });
        if (error) {
          console.error('[Supabase]', error);
          return;
        }
        if (cancelled) {
          return;
        }
        const pets = data ?? [];
        const preferred =
          pets.find((p) => String(p.id) === String(activePetId)) ?? pets[0] ?? null;
        setReporterPet(preferred);
      } catch (e) {
        console.error('[ReportSheet] load pets', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePetId, reset, visible]);

  const handleClose = useCallback(() => {
    if (busy) {
      return;
    }
    onClose?.();
  }, [busy, onClose]);

  const handleSubmit = useCallback(async () => {
    if (busy || !reasonId) {
      return;
    }
    setErrorText('');

    if (!reporterPet?.id) {
      setErrorText('Add a pet to report.');
      return;
    }

    // Local demo / non-UUID content — acknowledge quietly without writing.
    if (!canPersist) {
      setStep('done');
      onSubmitted?.({ demo: true });
      return;
    }

    setBusy(true);
    try {
      await createReport({
        reporterPetId: reporterPet.id,
        targetType,
        targetId,
        reportedUserId,
        reason: reasonLabel,
        details: details.trim() || null,
      });
      setStep('done');
      onSubmitted?.({ demo: false });
    } catch (e) {
      console.error('[ReportSheet] submit', e);
      setErrorText('Could not send right now. Try again.');
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    canPersist,
    details,
    onSubmitted,
    reasonId,
    reasonLabel,
    reportedUserId,
    reporterPet?.id,
    targetId,
    targetType,
  ]);

  const handleBlock = useCallback(
    async (pet) => {
      const petId = String(pet?.id ?? '');
      if (!petId || blockBusyId) {
        return;
      }
      if (!UUID_RE.test(petId)) {
        setErrorText('This pet cannot be blocked.');
        return;
      }
      setBlockBusyId(petId);
      setErrorText('');
      try {
        await blockPet(petId);
        onBlocked?.(pet);
      } catch (e) {
        console.error('[ReportSheet] block', e);
        setErrorText('Could not block right now.');
      } finally {
        setBlockBusyId(null);
      }
    },
    [blockBusyId, onBlocked],
  );

  const title =
    step === 'done'
      ? 'Thank you'
      : targetType === 'meetup'
        ? 'Report meetup'
        : 'Report moment';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.handle} />
        <Text style={styles.title} allowFontScaling>
          {title}
        </Text>

        {step === 'reason' ? (
          <>
            {reporterPet?.name ? (
              <Text style={styles.asPet} allowFontScaling>
                {`As ${reporterPet.name}`}
              </Text>
            ) : null}
            <Text style={styles.hint} allowFontScaling>
              Flags the account for human review.
            </Text>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {REPORT_REASONS.map((reason) => {
                const selected = reasonId === reason.id;
                return (
                  <Pressable
                    key={reason.id}
                    onPress={() => {
                      setReasonId(reason.id);
                      setStep('details');
                    }}
                    style={({ pressed }) => [
                      styles.reasonRow,
                      selected && styles.reasonRowSelected,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={reason.label}
                  >
                    <Text style={styles.reasonText} allowFontScaling>
                      {reason.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.deferredNote} allowFontScaling>
              Mating session reports come later.
            </Text>
          </>
        ) : null}

        {step === 'details' ? (
          <>
            <Text style={styles.selectedReason} allowFontScaling>
              {reasonLabel}
            </Text>
            <TextInput
              style={styles.detailsInput}
              value={details}
              onChangeText={setDetails}
              placeholder="Optional note"
              placeholderTextColor={theme.colors.placeholder.value}
              multiline
              maxLength={400}
              editable={!busy}
              accessibilityLabel="Optional note"
            />
            {errorText ? (
              <Text style={styles.errorText} allowFontScaling>
                {errorText}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                onPress={() => setStep('reason')}
                disabled={busy}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={styles.secondaryBtnText} allowFontScaling>
                  Back
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  busy && styles.primaryBtnDisabled,
                  pressed && !busy && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send report"
              >
                {busy ? (
                  <ActivityIndicator color={theme.colors.text.inverse.value} />
                ) : (
                  <Text style={styles.primaryBtnText} allowFontScaling>
                    Send
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <Text style={styles.doneBody} allowFontScaling>
              Our team will review this. No public scores or counts.
            </Text>
            {blockablePets.length > 0 ? (
              <View style={styles.blockSection}>
                <Text style={styles.blockHeading} allowFontScaling>
                  Block
                </Text>
                {blockablePets.map((pet) => (
                  <Pressable
                    key={String(pet.id)}
                    onPress={() => handleBlock(pet)}
                    disabled={Boolean(blockBusyId)}
                    style={({ pressed }) => [styles.blockRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Block ${pet.name || 'pet'}`}
                  >
                    {blockBusyId === String(pet.id) ? (
                      <ActivityIndicator color={theme.colors.brand.sage.value} />
                    ) : (
                      <Text style={styles.blockRowText} allowFontScaling>
                        {`Block ${pet.name || 'pet'}`}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {errorText ? (
              <Text style={styles.errorText} allowFontScaling>
                {errorText}
              </Text>
            ) : null}
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.primaryBtn, styles.doneBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.primaryBtnText} allowFontScaling>
                Done
              </Text>
            </Pressable>
          </>
        ) : null}
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
    maxHeight: '82%',
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
  asPet: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.brand.sageDark.value ?? theme.colors.brand.sage.value,
    marginBottom: 4,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginBottom: 16,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    paddingBottom: 8,
    gap: 8,
  },
  reasonRow: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: theme.colors.background.light,
  },
  reasonRowSelected: {
    backgroundColor: theme.colors.brand.sageLight.light,
  },
  reasonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  deferredNote: {
    marginTop: 16,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
  },
  selectedReason: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginBottom: 12,
  },
  detailsInput: {
    minHeight: 96,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.background.light,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
  doneBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
    color: theme.colors.text.secondary.light,
    marginBottom: 20,
  },
  blockSection: {
    marginBottom: 16,
    gap: 8,
  },
  blockHeading: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    marginBottom: 4,
  },
  blockRow: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: theme.colors.background.light,
  },
  blockRowText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  doneBtn: {
    marginTop: 4,
  },
  errorText: {
    marginTop: 12,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
