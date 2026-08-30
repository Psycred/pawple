import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MeetupCard from '../components/MeetupCard';
import LoadErrorRetry from '../components/LoadErrorRetry';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../config/theme';
import { supabase } from '../config/supabase';
import { fetchPublicUserProfile } from '../services/userProfile';

/**
 * Public human user profile — hosted meetups only when viewing someone else.
 * Going / RSVP history is never shown unless viewer === profile owner.
 */
export default function PublicUserProfileScreen({ navigation, route }) {
  const viewedUserId = route?.params?.userId ?? route?.params?.viewedUserId ?? null;
  const viewerUserId = route?.params?.viewerUserId ?? null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState(null);
  const [hostedMeetups, setHostedMeetups] = useState([]);
  const [isSelfView, setIsSelfView] = useState(false);
  const [resolvedViewerId, setResolvedViewerId] = useState(viewerUserId);
  const [viewerPets, setViewerPets] = useState([]);

  const loadProfile = useCallback(async () => {
    if (!viewedUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      let resolvedViewerId = viewerUserId;
      if (!resolvedViewerId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        resolvedViewerId = user?.id ?? null;
      }

      const [data, petsResult] = await Promise.all([
        fetchPublicUserProfile(viewedUserId, resolvedViewerId),
        resolvedViewerId
          ? supabase.from('pets').select('id, name').eq('owner_id', resolvedViewerId)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (petsResult.error) {
        console.error('[Supabase]', petsResult.error);
      }
      setProfile(data?.profile ?? null);
      setHostedMeetups(data?.hostedMeetups ?? []);
      setIsSelfView(Boolean(data?.isSelfView));
      setResolvedViewerId(resolvedViewerId);
      setViewerPets(petsResult.error ? [] : petsResult.data ?? []);
      setLoadError(false);
    } catch (error) {
      console.error('[PublicUserProfile] load failed', error);
      setLoadError(true);
      setProfile(null);
      setHostedMeetups([]);
      setIsSelfView(false);
      setViewerPets([]);
    } finally {
      setLoading(false);
    }
  }, [viewedUserId, viewerUserId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const displayName = profile?.name?.trim() || 'Pet parent';

  return (
    <ScreenWrapper
      title={displayName}
      showBackButton
      onClose={() => navigation.goBack()}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.brand.sage.value} />
        </View>
      ) : loadError ? (
        <LoadErrorRetry onRetry={loadProfile} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {profile?.city ? (
            <Text style={styles.city} allowFontScaling>
              {profile.city}
            </Text>
          ) : null}

          <Text style={styles.sectionTitle} allowFontScaling>
            Hosted Meetups
          </Text>

          {hostedMeetups.length === 0 ? (
            <Text style={styles.emptyText} allowFontScaling>
              {isSelfView
                ? "You haven't hosted a meetup yet."
                : `${displayName} hasn't hosted a meetup yet.`}
            </Text>
          ) : (
            hostedMeetups.map((meetup) => (
              <MeetupCard
                key={String(meetup.id)}
                meetup={meetup}
                actionVariant={isSelfView ? 'hosting' : 'rsvp'}
                viewerPets={viewerPets}
                viewerId={resolvedViewerId}
              />
            ))
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  city: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.muted.light,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.fonts.scale.cardTitle,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
  },
});
