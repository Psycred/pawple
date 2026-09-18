import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { MAX_TRAITS, TRAIT_SUGGESTIONS, normalizeTraits } from '../constants/petTraits';
import { updatePetTraits } from '../services/pets';

/**
 * Owner-only trait picker — separate from Open to Mating.
 */
export default function PetTraitsSection({
  petId,
  petName,
  traits = [],
  onTraitsChange,
}) {
  const [selectedTraits, setSelectedTraits] = useState(() => normalizeTraits(traits));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedTraits(normalizeTraits(traits));
  }, [traits]);

  const displayName = petName?.trim() || 'your pet';
  const surfaces = useRuntimeThemeColors();

  const persistTraits = useCallback(
    async (nextTraits, fallbackTraits) => {
      if (!petId) {
        return;
      }
      const normalized = normalizeTraits(nextTraits);
      setSaving(true);
      try {
        const updated = await updatePetTraits(petId, normalized);
        const savedTraits = normalizeTraits(updated?.traits);
        setSelectedTraits(savedTraits);
        onTraitsChange?.(savedTraits);
      } catch (e) {
        console.error('[PetTraitsSection] save', e);
        setSelectedTraits(normalizeTraits(fallbackTraits));
      } finally {
        setSaving(false);
      }
    },
    [onTraitsChange, petId],
  );

  const handleTraitToggle = useCallback(
    (trait) => {
      if (saving) {
        return;
      }

      const previous = selectedTraits;
      let next = previous;

      if (previous.includes(trait)) {
        next = previous.filter((item) => item !== trait);
      } else if (previous.length >= MAX_TRAITS) {
        return;
      } else {
        next = [...previous, trait];
      }

      setSelectedTraits(next);
      persistTraits(next, previous);
    },
    [persistTraits, saving, selectedTraits],
  );

  return (
    <View style={[styles.card, { backgroundColor: surfaces.backgroundCard }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: surfaces.textPrimary }]} allowFontScaling>
          Traits
        </Text>
        <Text style={[styles.counter, { color: surfaces.textMuted }]} allowFontScaling>
          {`${selectedTraits.length} / ${MAX_TRAITS}`}
        </Text>
      </View>

      <Text style={[styles.helper, { color: surfaces.textMuted }]} allowFontScaling>
        {`Choose up to ${MAX_TRAITS} traits that best describe ${displayName}.`}
      </Text>

      <View style={styles.chips}>
        {TRAIT_SUGGESTIONS.map((trait) => {
          const isSelected = selectedTraits.includes(trait);
          const isDisabled = saving || (!isSelected && selectedTraits.length >= MAX_TRAITS);

          return (
            <Pressable
              key={trait}
              onPress={() => handleTraitToggle(trait)}
              disabled={isDisabled}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: surfaces.backgroundScreen,
                  borderColor: surfaces.border,
                },
                isSelected && styles.chipSelected,
                isDisabled && !isSelected && styles.chipDisabled,
                pressed && !isDisabled && styles.pressed,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              accessibilityLabel={trait}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: surfaces.textPrimary },
                  isSelected && styles.chipTextSelected,
                ]}
                allowFontScaling
              >
                {trait}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 28,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.md,
  },
  counter: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
  },
  helper: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: theme.colors.brand.sage.light,
    borderColor: theme.colors.brand.sage.light,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
  },
  chipTextSelected: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text.inverse.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
