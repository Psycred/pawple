import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from '../config/theme';

const COMPANION_HELPER =
  'Turn this on to let other pet parents find and connect with you.';

/**
 * Owner-only companion discovery toggle + subtle community meetup counts.
 */
export default function PetCompanionCommunitySection({
  showToggle = false,
  lookingForCompanion = false,
  onToggle,
  toggleDisabled = false,
  hostedCount = 0,
  participatedCount = 0,
  showCommunity = true,
  communityAction = null,
}) {
  return (
    <View style={styles.wrap}>
      {showToggle ? (
        <View style={styles.companionBlock}>
          <View style={styles.companionRow}>
            <Text style={styles.companionLabel} allowFontScaling>
              Looking for a Companion
            </Text>
            <Switch
              value={lookingForCompanion}
              onValueChange={onToggle}
              disabled={toggleDisabled}
              trackColor={{
                false: theme.colors.border.light,
                true: theme.colors.brand.sage.light,
              }}
              thumbColor={theme.colors.background.card}
              accessibilityLabel="Looking for a companion"
              accessibilityHint={COMPANION_HELPER}
            />
          </View>
          <Text style={styles.companionHelper} allowFontScaling>
            {COMPANION_HELPER}
          </Text>
        </View>
      ) : null}

      {showCommunity ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} allowFontScaling>
              Community
            </Text>
            {communityAction}
          </View>
          <View style={styles.communityCard}>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber} allowFontScaling>
                {hostedCount}
              </Text>
              <Text style={styles.statLabel} allowFontScaling>
                Hosted
              </Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber} allowFontScaling>
                {participatedCount}
              </Text>
              <Text style={styles.statLabel} allowFontScaling>
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
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  companionLabel: {
    flex: 1,
    paddingRight: theme.spacing.md,
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  companionHelper: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: Math.round(theme.fontSizes.sm * theme.lineHeights.normal),
    color: theme.colors.text.muted.light,
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
    color: theme.colors.text.primary.light,
  },
  communityCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.card,
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
    color: theme.colors.text.primary.light,
  },
  statLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text.muted.light,
  },
});
