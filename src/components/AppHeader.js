import { Feather } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
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
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import PawpleStorageImage from './PawpleStorageImage';
import PetSelector from './PetSelector';

function AppHeader({
  onPressSettings,
  onPressNotifications,
  showSettings = true,
  showNotifications = false,
  hasUnreadNotifications = false,
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { activePetId, activePet, setPet, loading: activePetLoading } = useActivePet();
  const [pets, setPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(32)).current;

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
    fetchPets();
    setModalVisible(true);
  }, [fetchPets]);

  const handleSelectPet = useCallback(
    async (pet) => {
      await setPet(String(pet.id), {
        id: pet.id,
        name: pet.name,
        photo_url: pet.photo_url,
      });
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

  const handlePressNotifications = useCallback(() => {
    if (onPressNotifications) {
      onPressNotifications();
      return;
    }
    const routeNames = navigation.getState()?.routeNames ?? [];
    if (routeNames.includes('Notifications')) {
      navigation.navigate('Notifications');
      return;
    }
    const parentNav = navigation.getParent?.();
    const parentRouteNames = parentNav?.getState?.()?.routeNames ?? [];
    if (parentRouteNames.includes('Notifications')) {
      parentNav.navigate('Notifications');
    }
  }, [navigation, onPressNotifications]);

  const activePetName = activePet?.name?.trim() || 'Pets';
  const surfaces = useRuntimeThemeColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: surfaces.backgroundScreen,
          borderBottomColor: surfaces.border,
          paddingTop: insets.top,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm + 2,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.leftCluster}>
          <PetSelector
            pet={activePet}
            identityLoading={activePetLoading && !activePet}
            onPress={openModal}
            accessibilityHint={`Current pet is ${activePetName}`}
          />
        </View>

        <View style={styles.headerActions}>
          {showNotifications ? (
            <TouchableOpacity
              onPress={handlePressNotifications}
              style={styles.headerActionHit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Feather name="bell" size={24} color={theme.colors.text.muted.light} />
              {hasUnreadNotifications ? <View style={styles.unreadIndicator} /> : null}
            </TouchableOpacity>
          ) : null}
          {showSettings ? (
            <TouchableOpacity
              onPress={handlePressSettings}
              style={styles.headerActionHit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Feather name="settings" size={24} color={theme.colors.text.muted.light} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeModal} accessibilityLabel="Dismiss pet selector">
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.modalSheet,
              {
                backgroundColor: surfaces.backgroundElevated,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: surfaces.textPrimary }]}>Your pets</Text>
            {loadingPets ? (
              <Text style={[styles.helperText, { color: surfaces.textMuted }]}>Loading pets...</Text>
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
                      style={[
                        styles.petRow,
                        selected && [
                          styles.petRowSelected,
                          { backgroundColor: surfaces.backgroundScreen },
                        ],
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name}${selected ? ', selected' : ''}`}
                      accessibilityHint="Switch pet"
                    >
                      <PetSelectorAvatar
                        photoUrl={item.photo_url}
                        initial={initial}
                        textPrimary={surfaces.textPrimary}
                      />
                      <Text style={[styles.rowName, { color: surfaces.textPrimary }]}>
                        {item.name || 'Unnamed pet'}
                      </Text>
                      {selected ? (
                        <Feather name="check" size={18} color={theme.colors.primary.light} />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => (
                  <View style={[styles.separator, { backgroundColor: surfaces.border }]} />
                )}
                ListFooterComponent={
                  <TouchableOpacity
                    onPress={handleAddPet}
                    activeOpacity={0.85}
                    style={[styles.addPetButton, { borderColor: surfaces.border }]}
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

function PetSelectorAvatar({ photoUrl, initial, textPrimary }) {
  if (photoUrl) {
    return <PawpleStorageImage source={{ uri: photoUrl }} style={styles.rowAvatar} />;
  }
  return (
    <View style={styles.rowAvatarFallback}>
      <Text style={[styles.rowAvatarInitial, { color: textPrimary }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionHit: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadIndicator: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.spacing.sm / 2,
    backgroundColor: theme.colors.brand.sage.light,
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
  },
  helperText: {
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
  },
  petRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  petRowSelected: {
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
    fontWeight: theme.fontWeights.semibold,
  },
  rowName: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
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
  },
  addPetText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.action.primary.value,
    fontWeight: theme.fontWeights.medium,
  },
});
