import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';
import { LEGAL_LAST_UPDATED } from '../content/legalDocuments';

/**
 * Shared layout for Terms, Privacy, and Community Guidelines.
 * Keeps legal surfaces visually consistent and calm.
 */
export default function LegalDocumentView({ title, sections }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>{title}</Text>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text selectable numberOfLines={0} style={styles.sectionBody}>
              {section.body}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>Last updated: {LEGAL_LAST_UPDATED}</Text>
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
    paddingTop: theme.spacing.xl,
    // Extra bottom room so last sections clear gesture area calmly.
    paddingBottom: theme.spacing.xxl,
    flexGrow: 1,
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
