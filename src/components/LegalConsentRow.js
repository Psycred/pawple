import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';

export default function LegalConsentRow() {
  const navigation = useNavigation();

  return (
    <View style={styles.row}>
      <Text style={styles.baseText}>
        By tapping 'Create Profile', you confirm you are 18 or older and agree to our{' '}
        <Text
          style={styles.linkText}
          accessibilityRole="link"
          accessibilityLabel="Open Terms of Service"
          onPress={() => navigation.navigate('TermsOfService')}
        >
          Terms
        </Text>
        {', '}
        <Text
          style={styles.linkText}
          accessibilityRole="link"
          accessibilityLabel="Open Privacy Policy"
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          Privacy Policy
        </Text>
        {', and '}
        <Text
          style={styles.linkText}
          accessibilityRole="link"
          accessibilityLabel="Open Community Guidelines"
          onPress={() => navigation.navigate('CommunityGuidelines')}
        >
          Community Guidelines
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  baseText: {
    ...theme.fonts.legalDisclosure,
    textAlign: 'center',
  },
  linkText: {
    ...theme.fonts.legalLink,
  },
});
