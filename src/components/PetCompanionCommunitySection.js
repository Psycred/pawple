import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

const COMPANION_HELPER =
  'Turn this on so suitable mating opportunities can include this pet.';

/**
 * Owner-only companion discovery toggle + subtle community meetup counts.
 * Internal companion identifiers remain unchanged; users see "Open to Mating".
 */
export default function PetCompanionCommunitySection({
  showToggle = false,
  lookingForCompanion = false,
  onToggle,
  toggleDisabled = false,
  hostedCount = 0,
  participatedCount = 0,
  showCommunity = true,
}) {
  const surfaces = useRuntimeThemeColors();

  return (
    <View style={styles.wrap}>
      {showToggle ? (
        <View style={[styles.companionBlock, { backgroundColor: surfaces.backgroundCard }]}>
          <View style={styles.companionRow}>
            <Text style={[styles.companionLabel, { color: surfaces.textPrimary }]} allowFontScaling>
              Open to Mating
            </Text>
            <Switch
              value={lookingForCompanion}
              onValueChange={onToggle}
              disabled={toggleDisabled}
              trackColor={{
                false: surfaces.border,
                true: theme.colors.brand.sage.light,
              }}
              thumbColor={surfaces.backgroundCard}
              accessibilityLabel="Open to Mating"
              accessibilityHint={COMPANION_HELPER}
            />
          </View>
        </View>
      ) : null}

      {showCommunity ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: surfaces.textPrimary }]} allowFontScaling>
              Community
            </Text>
          </View>
          <View style={[styles.communityCard, { backgroundColor: surfaces.backgroundCard }]}>
            <View style={styles.statColumn}>
              <Text style={[styles.statNumber, { color: surfaces.textPrimary }]} allowFontScaling>
                {hostedCount}
              </Text>
              <Text style={[styles.statLabel, { color: surfaces.textMuted }]} allowFontScaling>
                Hosted
              </Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={[styles.statNumber, { color: surfaces.textPrimary }]} allowFontScaling>
                {participatedCount}
              </Text>
              <Text style={[styles.statLabel, { color: surfaces.textMuted }]} allowFontScaling>
                Joined
              </Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  companionBlock: {
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companionLabel: {
    flex: 1,
    paddingRight: theme.spacing.md,
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.lg,
  },
  communityCard: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statNumber: {
    fontFamily: theme.fonts.semibold,
    fontSize: theme.fontSizes.xl,
  },
  statLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
  },
});
