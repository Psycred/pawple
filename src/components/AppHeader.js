import { Feather } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import PetSelector from './PetSelector';

const FETCH_DEBOUNCE_MS = 120;

function AppHeader({ onPressSettings }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { activePetId, setPet } = useActivePet();
  const [pets, setPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const fetchTimerRef = useRef(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(32)).current;

  const activePet = useMemo(() => pets.find((pet) => String(pet.id) === String(activePetId)) ?? null, [activePetId, pets]);

  const fetchPets = useCallback(async () => {
    setLoadingPets(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPets([]);
        return;
      }
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, photo_url')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });
      if (error) {
        throw error;
      }
      setPets(data ?? []);
    } catch (error) {
      console.log('[AppHeader] Pets fetch error', error);
      setPets([]);
    } finally {
      setLoadingPets(false);
    }
  }, []);

  const debouncedFetchPets = useCallback(() => {
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
    }
    fetchTimerRef.current = setTimeout(() => {
      fetchPets();
    }, FETCH_DEBOUNCE_MS);
  }, [fetchPets]);

  useEffect(() => {
    debouncedFetchPets();
    return () => {
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
    };
  }, [debouncedFetchPets]);

  useEffect(() => {
    if (!modalVisible) {
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(32);
      return;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0.36,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 80,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, modalVisible, sheetTranslateY]);

  const closeModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 32,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setModalVisible(false);
      }
    });
  }, [backdropOpacity, sheetTranslateY]);

  const openModal = useCallback(() => {
    debouncedFetchPets();
    setModalVisible(true);
  }, [debouncedFetchPets]);

  const handleSelectPet = useCallback(
    async (pet) => {
      await setPet(String(pet.id));
      console.log(`[Header] Switched to ${pet.id}`);
      AccessibilityInfo.announceForAccessibility?.(`Switched to ${pet.name}`);
      closeModal();
    },
    [closeModal, setPet],
  );

  const handleAddPet = useCallback(() => {
    closeModal();
    const parentNav = navigation.getParent?.();
    if (parentNav?.navigate) {
      parentNav.navigate('OnboardingPets', { mode: 'add' });
      return;
    }
    navigation.navigate('OnboardingPets', { mode: 'add' });
  }, [closeModal, navigation]);

  const handlePressSettings = useCallback(() => {
    if (onPressSettings) {
      onPressSettings();
      return;
    }
    const routeNames = navigation.getState()?.routeNames ?? [];
    if (routeNames.includes('Settings')) {
      navigation.navigate('Settings');
      return;
    }
    const parentNav = navigation.getParent?.();
    const parentRouteNames = parentNav?.getState?.()?.routeNames ?? [];
    if (parentRouteNames.includes('Settings')) {
      parentNav.navigate('Settings');
      return;
    }
    navigation.navigate('ManagePets');
  }, [navigation, onPressSettings]);

  const activePetName = activePet?.name?.trim() || 'Your pet';

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm + 2,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.leftCluster}>
          <PetSelector pet={activePet} onPress={openModal} accessibilityHint={`Current pet is ${activePetName}`} />
        </View>

        <TouchableOpacity
          onPress={handlePressSettings}
          style={styles.settingsHit}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Feather name="settings" size={24} color={theme.colors.text.muted.light} />
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeModal} accessibilityLabel="Dismiss pet selector">
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          </TouchableOpacity>

          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <Text style={styles.sheetTitle}>Your pets</Text>
            {loadingPets ? (
              <Text style={styles.helperText}>Loading pets...</Text>
            ) : (
              <FlatList
                data={pets}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const selected = String(item.id) === String(activePetId);
                  const initial = item?.name?.trim()?.charAt(0)?.toUpperCase() || '?';
                  return (
                    <TouchableOpacity
                      onPress={() => handleSelectPet(item)}
                      activeOpacity={0.85}
                      style={[styles.petRow, selected && styles.petRowSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name}${selected ? ', selected' : ''}`}
                      accessibilityHint="Switch pet"
                    >
                      <PetSelectorAvatar photoUrl={item.photo_url} initial={initial} />
                      <Text style={styles.rowName}>{item.name || 'Unnamed pet'}</Text>
                      {selected ? (
                        <Feather name="check" size={18} color={theme.colors.primary.light} />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListFooterComponent={
                  <TouchableOpacity
                    onPress={handleAddPet}
                    activeOpacity={0.85}
                    style={styles.addPetButton}
                    accessibilityRole="button"
                    accessibilityLabel="Add another pet"
                  >
                    <Feather name="plus-circle" size={16} color={theme.colors.action.primary.value} />
                    <Text style={styles.addPetText}>Add another pet</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

export default memo(AppHeader);

function PetSelectorAvatar({ photoUrl, initial }) {
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={styles.rowAvatar} />;
  }
  return (
    <View style={styles.rowAvatarFallback}>
      <Text style={styles.rowAvatarInitial}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.light,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  leftCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  settingsHit: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.text.primary.light,
  },
  modalSheet: {
    maxHeight: '72%',
    backgroundColor: theme.colors.card.light,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    ...theme.shadowsRN.sm,
  },
  sheetTitle: {
    marginBottom: theme.spacing.md,
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
  },
  helperText: {
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  petRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  petRowSelected: {
    backgroundColor: theme.colors.background.light,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: theme.spacing.sm,
  },
  rowAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary.light,
  },
  rowAvatarInitial: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.semibold,
  },
  rowName: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.light,
  },
  addPetButton: {
    minHeight: 44,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  addPetText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.action.primary.value,
    fontWeight: theme.fontWeights.medium,
  },
});
