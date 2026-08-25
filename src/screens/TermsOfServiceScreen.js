import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';

const termsContent = [
  {
    title: '1. Acceptance of Terms',
    body: 'Welcome to Pawple ("the Service"). By accessing or using Pawple, a pet community platform operated by Pawple Labs ("we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.',
  },
  {
    title: '2. Description of Service',
    body: 'Pawple is a mobile application that allows pet owners to create profiles for their pets, share photos and memories in a journal format, discover and join local pet meetups and events, connect with other pet owners, and send/receive invitations. We reserve the right to modify, suspend, or discontinue any part of the Service at any time without notice.',
  },
  {
    title: '3. Eligibility',
    body: 'You must be at least 13 years old to use Pawple. By using the Service, you represent and warrant that you are at least 13 years old and have the legal capacity to enter into these Terms. If you are under 18, you may only use the Service with the involvement and consent of a parent or legal guardian.',
  },
  {
    title: '4. User Accounts',
    body: 'To use certain features, you must create an account. You agree to provide accurate information, maintain account security, keep your password confidential, and notify us immediately of unauthorized use. You are responsible for all activities under your account.',
  },
  {
    title: '5. User Conduct',
    body: 'You agree NOT to post illegal, harmful, threatening, abusive, or defamatory content; impersonate others; upload malware; use the Service for commercial purposes without consent; harvest user data; interfere with the Service; or post content that infringes third-party rights or depicts animal cruelty.',
  },
  {
    title: '6. Pet Safety & Community Standards',
    body: 'Pawple is dedicated to pet safety. You agree to only post content of pets you own or have permission to share, never encourage harmful treatment of animals, respect other users\' pets at meetups, supervise your pets at events, and accept that Pawple is not responsible for pet/user interactions. We may remove content or ban users who violate these standards.',
  },
  {
    title: '7. Content Ownership & License',
    body: 'You retain ownership of your content. By posting, you grant Pawple a worldwide, non-exclusive, royalty-free license to use, reproduce, distribute, and display your content in connection with the Service. Content you post may be viewed and shared by other users per your privacy settings.',
  },
  {
    title: '8. Meetups & Events',
    body: 'Events are organized by community members. Pawple does not vet, endorse, or guarantee safety. Participation is at your own risk. You are responsible for supervising your pet and ensuring it is vaccinated/socialized. Additional waivers may apply.',
  },
  {
    title: '9. Invite System',
    body: 'Pawple uses an invite-only system. You agree to only send invites to people you know, not sell/trade codes, and accept that we may revoke privileges if abused. Invited users\' violations may affect your account.',
  },
  {
    title: '10. Disclaimer of Warranties',
    body: 'THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT CONTENT WILL BE ACCURATE. YOUR USE IS AT YOUR SOLE RISK.',
  },
  {
    title: '11. Limitation of Liability',
    body: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, PAWPLE IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR INJURY TO YOU/YOUR PET ARISING FROM THE SERVICE OR EVENTS. TOTAL LIABILITY SHALL NOT EXCEED $100 OR AMOUNT PAID IN LAST 12 MONTHS.',
  },
  {
    title: '12. Indemnification',
    body: 'You agree to defend, indemnify, and hold harmless Pawple from claims, liabilities, or fees arising from your violation of these Terms, your content, or incidents involving your pet.',
  },
  {
    title: '13. Governing Law & Dispute Resolution',
    body: 'These Terms are governed by the laws of India. Disputes shall be resolved through binding arbitration on an individual basis. Class actions are waived. Either party may bring claims in small claims court.',
  },
  {
    title: '14. Changes to Terms',
    body: 'We may modify these Terms at any time. Material changes will be notified via app, email, or push notification. Continued use constitutes acceptance.',
  },
  {
    title: '15. Contact',
    body: 'Questions? Email us at legal@pawple.com or visit www.pawple.com/contact.',
  },
];

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Terms of Service</Text>

        {termsContent.map((section) => (
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
