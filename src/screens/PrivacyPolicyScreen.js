import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';

const privacyContent = [
  {
    title: 'Introduction',
    body: 'At Pawple, we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our app. By using Pawple, you agree to this policy.',
  },
  {
    title: '1. Information We Collect',
    body: 'Account: Name, email, phone, password (encrypted), profile photo.\nPet Info: Name, breed, age, photos/videos, medical/behavioral notes you choose to share.\nContent: Journal entries, captions, location tags, meetup attendance, messages.\nDevice & Usage: Device type, OS, IP address, usage patterns, session duration, features used.\nLocation: Precise (GPS) for meetups, approximate (IP) for content localization.\nThird Parties: Analytics, crash reports, referral data.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'Provide & maintain the Service, create/manage accounts, facilitate meetups, process invites, improve/personalize your feed, send transactional messages & push notifications, ensure safety/security, moderate content, conduct analytics, and comply with legal obligations.',
  },
  {
    title: '3. How We Share Your Information',
    body: 'WE DO NOT SELL YOUR DATA. We share only with: Other Users (public profile info, posts per settings, check-in locations), Service Providers (hosting, analytics, notifications, storage, email), Legal Authorities (when required by law), or Business Transfers (mergers/acquisitions with notice).',
  },
  {
    title: '4. Location Data',
    body: 'Used to show nearby meetups and connect you with local pet owners. You can grant/deny permission or use approximate location only in device settings. Disabling location limits some features.',
  },
  {
    title: '5. Cookies & Tracking',
    body: 'We use essential, preference, and analytics cookies to remember settings, keep you logged in, and understand usage. You can control cookies through device settings.',
  },
  {
    title: '6. Data Retention',
    body: 'Account data: Until deletion + 30 days. Journal posts: Until deleted. Messages: 90 days. Analytics: 26 months (anonymized thereafter). Backups: Up to 90 days. You may request deletion anytime via Settings > Delete Account.',
  },
  {
    title: '7. Data Security',
    body: 'We implement encryption in transit (TLS) and at rest (AES-256), secure authentication, regular security audits, and limited employee access. No method is 100% secure. Breaches will be notified within 72 hours as required by law.',
  },
  {
    title: '8. Your Rights',
    body: 'Access, rectification, erasure, restrict processing, object to processing, data portability, and withdraw consent. Contact privacy@pawple.com. We respond within 30 days. EEA/GDPR and California/CCPA rights apply where applicable.',
  },
  {
    title: "9. Children's Privacy",
    body: 'Pawple is not intended for children under 13. We do not knowingly collect data from children. If discovered, we delete it immediately. Contact us if you believe a child has provided information.',
  },
  {
    title: '10. International Transfers',
    body: 'Data may be transferred to and processed in countries outside your jurisdiction. We ensure appropriate safeguards (SCCs, adequacy decisions) are in place.',
  },
  {
    title: '11. Push Notifications',
    body: 'We may send meetup reminders, messages, and journal interactions. You may opt-out anytime via App or Device Settings > Notifications.',
  },
  {
    title: '12. Changes to This Policy',
    body: 'We may update this policy. Material changes will be notified via app, email, or push notification. Continued use constitutes acceptance.',
  },
  {
    title: '13. Contact',
    body: 'Questions? Email privacy@pawple.com or visit www.pawple.com/privacy.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Privacy Policy</Text>

        {privacyContent.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text selectable numberOfLines={0} style={styles.sectionBody}>
              {section.body}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>Last Updated: May 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.screen,
  },
  content: {
    paddingHorizontal: theme.spacing.xl - theme.spacing.xs,
    paddingVertical: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.xl,
    ...theme.fonts.legalPageTitle,
  },
  section: {
    marginTop: theme.spacing.xl,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
    ...theme.fonts.legalSectionTitle,
    fontWeight: theme.fontWeights.semibold,
  },
  sectionBody: {
    ...theme.fonts.legalBody,
    lineHeight: theme.spacing.xl,
  },
  footer: {
    marginTop: theme.spacing.xxl,
    textAlign: 'center',
    ...theme.fonts.legalDisclosure,
  },
});
