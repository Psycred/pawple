import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadErrorRetry from '../components/LoadErrorRetry';
import MomentCard from '../components/MomentCard';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { useAuth } from '../contexts/AuthContext';
import { fetchMomentById } from '../services/moments';

export default function MomentDetailsScreen({ route }) {
  const surfaces = useRuntimeThemeColors();
  const navigation = useNavigation();
  const { user } = useAuth();
  const momentId = route?.params?.momentId ?? null;
  const [moment, setMoment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadMoment = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const nextMoment = await fetchMomentById(momentId);
      setMoment(nextMoment);
    } catch {
      setMoment(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [momentId]);

  useEffect(() => {
    loadMoment();
  }, [loadMoment]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: surfaces.backgroundScreen }]}
        edges={['left', 'right', 'bottom']}
      >
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.brand.sage.light} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: surfaces.backgroundScreen }]}
        edges={['left', 'right', 'bottom']}
      >
        <LoadErrorRetry onRetry={loadMoment} />
      </SafeAreaView>
    );
  }

  if (!moment) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: surfaces.backgroundScreen }]}
        edges={['left', 'right', 'bottom']}
      >
        <View style={styles.centered}>
          <Text style={[styles.unavailable, { color: surfaces.textSecondary }]}>
            This moment is no longer available.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: surfaces.backgroundScreen }]}
      edges={['left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MomentCard
          moment={moment}
          viewerUserId={user?.id ?? null}
          onMomentDeleted={() => navigation.goBack()}
        />
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
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  unavailable: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 24,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
});
