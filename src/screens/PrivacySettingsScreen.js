import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { fetchBlockedPets, unblockPet } from '../services/blocks';

/**
 * Privacy settings — Phase-1 blocked pets list (Founder F / PAW-47).
 * No false DM / search-hiding promises.
 */
export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [errorText, setErrorText] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText('');
    try {
      const data = await fetchBlockedPets();
      setRows(data);
    } catch (e) {
      console.error('[PrivacySettings] load blocks', e);
      setErrorText('Could not load blocked pets.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleUnblock = useCallback(async (row) => {
    const petId = String(row?.blocked_pet_id ?? '');
    if (!petId || busyId) {
      return;
    }
    setBusyId(petId);
    setErrorText('');
    try {
      await unblockPet(petId);
      setRows((prev) => prev.filter((r) => String(r.blocked_pet_id) !== petId));
    } catch (e) {
      console.error('[PrivacySettings] unblock', e);
      setErrorText('Could not unblock right now.');
    } finally {
      setBusyId(null);
    }
  }, [busyId]);

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 24) }]}>
      <Text style={styles.lede} allowFontScaling>
        Blocked pets stay out of your feed. Report Moments and Meetups from the content itself.
      </Text>

      <View style={styles.group}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.brand.sage.value} />
          </View>
        ) : rows.length === 0 ? (
          <Text style={styles.empty} allowFontScaling>
            No blocked pets.
          </Text>
        ) : (
          rows.map((row, index) => {
            const pet = row.pet;
            const name = pet?.name || 'Pet';
            const petId = String(row.blocked_pet_id);
            return (
              <View key={String(row.id ?? petId)}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  {pet?.photo_url ? (
                    <Image source={{ uri: pet.photo_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial} allowFontScaling>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.petName} numberOfLines={1} allowFontScaling>
                      {name}
                    </Text>
                    {pet?.breed ? (
                      <Text style={styles.petMeta} numberOfLines={1} allowFontScaling>
                        {pet.breed}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => handleUnblock(row)}
                    disabled={Boolean(busyId)}
                    style={({ pressed }) => [styles.unblockBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${name}`}
                  >
                    {busyId === petId ? (
                      <ActivityIndicator size="small" color={theme.colors.brand.sage.value} />
                    ) : (
                      <Text style={styles.unblockText} allowFontScaling>
                        Unblock
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      {errorText ? (
        <Text style={styles.errorText} allowFontScaling>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  lede: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    lineHeight: 20,
    color: theme.colors.text.secondary.light,
    marginBottom: 24,
    marginTop: 8,
  },
  group: {
    backgroundColor: theme.colors.card.light,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: theme.colors.brand.sage.value,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    color: theme.colors.text.inverse.value,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  petMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary.light,
    marginTop: 2,
  },
  unblockBtn: {
    minHeight: 44,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unblockText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.brand.sageDark.value,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginHorizontal: 16,
  },
  errorText: {
    marginTop: 16,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.feedback.error.value,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
