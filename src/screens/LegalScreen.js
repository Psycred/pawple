import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';

const LEGAL_CONTENT = {
  terms: `Terms & Conditions

Last updated: May 2026

1. Account & Content
You own all photos and posts you upload to Pawple. By using the app, you grant Pawple a non-exclusive, royalty-free license to display your content within the app ecosystem. You are responsible for all content you share. Pawple prohibits NSFW material, spam, harassment, or misleading pet information.

2. Meetup Safety & Liability
All Pawple meetups are organized and attended voluntarily by pet parents. Pawple does not supervise, guarantee, or take liability for pet interactions, injuries, or property damage during meetups. Vaccination status is self-reported by users. Attend at your own discretion.

3. Data & Privacy
Pawple collects pet profiles, location preferences, and basic usage analytics to improve the experience. We never sell your data or share it with third parties for marketing. You retain full control over your data and can delete your account anytime via Settings.

4. Account Termination
Pawple reserves the right to suspend or remove accounts that violate these guidelines, engage in harmful behavior, or upload prohibited content. Users may delete their account and associated data permanently through the app settings at any time.

5. Contact
For questions, concerns, or legal inquiries: support@pawple.app`,

  privacy: `Privacy Policy

Last updated: May 2026

What We Collect
• Pet profiles (name, breed, age, photos, vaccination status)
• Location preferences (city, meetup radius)
• Usage data (feature interaction, crash reports, session duration)
• Invite code tracking (for referral analytics)

How We Use It
• To display and manage your pet's profile and memories
• To match you with local pet parents and meetups
• To send notifications (likes, invites, reminders) when enabled
• To improve app performance and fix bugs

Data Storage & Security
Your data is stored securely in Supabase with row-level security. We use industry-standard encryption for data in transit and at rest. We never sell, rent, or share personal data with advertisers.

Your Rights
You may view, edit, or delete your pet profiles and account data at any time via the app. Account deletion permanently removes all associated data from our servers within 30 days.

Contact & Updates
We may update this policy as features evolve. Significant changes will be notified in-app. For data requests: support@pawple.app`,
};

/**
 * Native in-app legal content screen (no webview / external URL).
 */
export default function LegalScreen({ route }) {
  const insets = useSafeAreaInsets();
  const type = route?.params?.type === 'privacy' ? 'privacy' : 'terms';
  const rawContent = LEGAL_CONTENT[type];

  const parsed = useMemo(() => {
    const lines = rawContent.split('\n');
    const title = lines[0] ?? '';
    const lastUpdated = lines[2] ?? '';
    const bodyLines = lines.slice(4);
    return { title, lastUpdated, bodyLines };
  }, [rawContent]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: theme.spacing.lg + insets.top,
            paddingBottom: theme.spacing.lg + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.mainTitle}>{parsed.title}</Text>
        <Text style={styles.lastUpdated}>{parsed.lastUpdated}</Text>
        {parsed.bodyLines.map((line, index) => {
          if (!line.trim()) {
            return <View key={`space-${index}`} style={styles.blockGap} />;
          }
          const isListItem = line.startsWith('• ');
          const isSectionHeader = !isListItem && /^[0-9]+\.\s/.test(line) || (!isListItem && !line.includes(':') && line.length < 40 && line === line.trim() && line[0] === line[0]?.toUpperCase() && !line.endsWith('.'));

          if (isListItem) {
            return (
              <View key={`list-${index}`} style={styles.listRow}>
                <Text style={styles.listText}>{line}</Text>
              </View>
            );
          }

          if (isSectionHeader) {
            return (
              <Text key={`header-${index}`} style={styles.sectionHeader}>
                {line}
              </Text>
            );
          }

          return (
            <Text key={`body-${index}`} style={styles.bodyText}>
              {line}
            </Text>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  mainTitle: {
    ...theme.fonts.legalPageTitle,
    fontSize: theme.fontSizes.xl,
    marginBottom: theme.spacing.xs,
  },
  lastUpdated: {
    ...theme.fonts.legalDisclosure,
    marginBottom: theme.spacing.lg + theme.spacing.xs,
  },
  sectionHeader: {
    ...theme.fonts.legalSectionTitle,
    fontWeight: theme.fontWeights.bold,
    marginTop: theme.spacing.lg + theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  bodyText: {
    ...theme.fonts.legalBody,
    lineHeight: Math.round(theme.fontSizes.md * 1.6),
  },
  listRow: {
    paddingLeft: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  listText: {
    ...theme.fonts.legalBody,
    lineHeight: Math.round(theme.fontSizes.md * 1.6),
  },
  blockGap: {
    marginBottom: theme.spacing.sm,
  },
});
