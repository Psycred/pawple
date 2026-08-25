import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../config/theme';

export default function LegalConsentRow() {
  const navigation = useNavigation();

  return (
    <View style={styles.row}>
      <Text style={styles.baseText}>
        By tapping 'Create Profile', you agree to our{' '}
        <Text
          style={styles.linkText}
          accessibilityRole="link"
          accessibilityLabel="Open Terms of Service"
          onPress={() => navigation.navigate('TermsOfService')}
        >
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text
          style={styles.linkText}
          accessibilityRole="link"
          accessibilityLabel="Open Privacy Policy"
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          Privacy Policy
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
