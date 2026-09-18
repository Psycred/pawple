import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

function formatAnnouncementDate(value) {
  const date = new Date(value ?? 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PawpleAnnouncementScreen({ navigation, route }) {
  const surfaces = useRuntimeThemeColors();
  const title = route?.params?.title?.trim() || 'A note from Pawple';
  const body = route?.params?.body?.trim() || '';
  const date = formatAnnouncementDate(route?.params?.createdAt);

  const announcementTheme = useMemo(
    () => ({
      title: { color: surfaces.textPrimary },
      date: { color: surfaces.textMuted },
      body: { color: surfaces.textSecondary },
    }),
    [surfaces.textMuted, surfaces.textPrimary, surfaces.textSecondary],
  );

  return (
    <ScreenWrapper
      title="Pawple"
      showBackButton
      onClose={() => navigation.goBack()}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, announcementTheme.title]} allowFontScaling>
          {title}
        </Text>
        {date ? (
          <Text style={[styles.date, announcementTheme.date]} allowFontScaling>
            {date}
          </Text>
        ) : null}
        {body ? (
          <Text style={[styles.body, announcementTheme.body]} allowFontScaling>
            {body}
          </Text>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.text.primary.light,
  },
  date: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  body: {
    marginTop: theme.spacing.xl,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 24,
    color: theme.colors.text.secondary.light,
  },
});
