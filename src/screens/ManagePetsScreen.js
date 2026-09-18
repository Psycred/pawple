import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';
import { useActivePet } from '../contexts/ActivePetContext';
import { resolveActivePetAfterDelete } from '../lib/activePetIntegrity';
import PawpleConfirmModal from '../components/PawpleConfirmModal';
import PawpleStorageImage from '../components/PawpleStorageImage';

const DESTRUCTIVE = theme.colors.destructive?.light ?? theme.colors.error.light;

/**
 * Private CRUD surface for the current user's pets.
 */
export default function ManagePetsScreen({ navigation }) {
  const surfaces = useRuntimeThemeColors();
  const insets = useSafeAreaInsets();
  const { activePetId, setPet } = useActivePet();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmPetId, setDeleteConfirmPetId] = useState(null);

  const manageTheme = useMemo(
    () => ({
      screen: { backgroundColor: surfaces.backgroundScreen },
      header: { borderBottomColor: surfaces.border },
      title: { color: surfaces.textPrimary },
      petName: { color: surfaces.textPrimary },
      petMeta: { color: surfaces.textMuted },
      divider: { backgroundColor: surfaces.border },
      emptyText: { color: surfaces.textSecondary },
      emptyAddButton: {
        backgroundColor: surfaces.backgroundCard,
        borderColor: surfaces.border,
      },
      emptyAddText: { color: surfaces.textPrimary },
    }),
    [
      surfaces.backgroundCard,
      surfaces.backgroundScreen,
      surfaces.border,
      surfaces.textMuted,
      surfaces.textPrimary,
      surfaces.textSecondary,
    ],
  );

  const fetchPets = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPets([]);
        return;
      }
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        throw error;
      }
      setPets(data ?? []);
    } catch (error) {
      console.log('[ManagePets] Fetch pets error:', error);
      Alert.alert('Pets', 'Could not load your pets right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPets();
    }, [fetchPets]),
  );

  const goToAdd = () => {
    navigation.navigate('OnboardingPets', { mode: 'add' });
  };

  const goToEdit = (petId, petName) => {
    navigation.navigate('EditPet', { petId, petName });
  };

  const handleDelete = async (petId) => {
    const previousPets = pets;
    const nextPets = pets.filter((pet) => pet.id !== petId);
    setDeletingId(petId);
    setPets(nextPets);
    try {
      const { error } = await supabase.from('pets').delete().eq('id', petId);
      if (error) {
        throw error;
      }
      Alert.alert('Pets', 'Pet removed');

      const nextPetId = resolveActivePetAfterDelete(activePetId, petId, nextPets);
      if (nextPetId !== undefined) {
        await setPet(nextPetId);
      }
    } catch (error) {
      console.log('[ManagePets] Delete pet error:', error);
      setPets(previousPets);
      Alert.alert('Pets', 'Could not remove this pet. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (petId) => {
    setDeleteConfirmPetId(petId);
  };

  const runConfirmedDelete = async () => {
    if (!deleteConfirmPetId) {
      return;
    }
    const petId = deleteConfirmPetId;
    setDeleteConfirmPetId(null);
    await handleDelete(petId);
  };

  const renderAvatar = (item) => {
    const initial = item?.name?.trim()?.charAt(0)?.toUpperCase() || '?';
    if (item?.photo_url) {
      return <PawpleStorageImage source={{ uri: item.photo_url }} style={styles.avatarImage} />;
    }
    return (
      <View style={styles.avatarCircle} accessibilityElementsHidden>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
    );
  };

  const renderPetMeta = (item) => {
    const breed = item?.breed?.trim() || 'Unknown breed';
    const age = item?.age ? `${item.age}y` : 'Age unknown';
    return `${breed} • ${age}`;
  };

  const listFooter = useMemo(
    () => (
      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
        onPress={goToAdd}
        accessibilityRole="button"
        accessibilityLabel="Add another pet"
      >
        <Text style={styles.addButtonText}>+ Add Another Pet</Text>
      </Pressable>
    ),
    [],
  );

  const renderItem = ({ item, index }) => (
    <View>
      <View style={styles.row}>
        {renderAvatar(item)}
        <View style={styles.centerBlock}>
          <Text style={[styles.petName, manageTheme.petName]} numberOfLines={1}>
            {item.name || 'Unnamed pet'}
          </Text>
          <Text style={[styles.petMeta, manageTheme.petMeta]} numberOfLines={1}>
            {renderPetMeta(item)}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => goToEdit(item.id, item.name)}
            style={({ pressed }) => [styles.iconHit, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name || 'pet'}`}
          >
            <Ionicons name="pencil-outline" size={20} color={surfaces.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => confirmDelete(item.id)}
            style={({ pressed }) => [styles.iconHit, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name || 'pet'}`}
            disabled={deletingId === item.id}
          >
            <Ionicons name="trash-outline" size={20} color={DESTRUCTIVE} />
          </Pressable>
        </View>
      </View>
      {index < pets.length - 1 ? <View style={[styles.divider, manageTheme.divider]} /> : null}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="paw-outline" size={theme.fontSizes.xxxl} color={surfaces.textMuted} />
      <Text style={[styles.emptyText, manageTheme.emptyText]}>No pets yet. Add your first friend!</Text>
      <Pressable
        style={({ pressed }) => [
          styles.emptyAddButton,
          manageTheme.emptyAddButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={goToAdd}
        accessibilityRole="button"
        accessibilityLabel="Add pet"
      >
        <Text style={[styles.emptyAddText, manageTheme.emptyAddText]}>+ Add Pet</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, manageTheme.screen, { paddingTop: insets.top }]}>
      <View style={[styles.header, manageTheme.header]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backHit, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Close manage pets"
        >
          <Ionicons name="chevron-back" size={22} color={surfaces.textPrimary} />
        </Pressable>
        <Text style={[styles.title, manageTheme.title]}>Your Pets</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary.light} />
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={pets.length > 0 ? listFooter : null}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchPets(true)} />}
          showsVerticalScrollIndicator={false}
          accessibilityLabel="Your pets list"
        />
      )}

      <PawpleConfirmModal
        visible={Boolean(deleteConfirmPetId)}
        busy={Boolean(deletingId)}
        onClose={() => {
          if (!deletingId) {
            setDeleteConfirmPetId(null);
          }
        }}
        onConfirm={runConfirmedDelete}
        title="Remove pet?"
        body="This will delete this pet's profile and memories."
        cancelLabel="Cancel"
        confirmLabel="Remove"
        icon="trash-2"
        iconTone="caution"
        confirmTone="sage"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background.light,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.light,
  },
  backHit: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    minHeight: 64,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary.light,
  },
  avatarInitial: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.components.button.primaryText,
  },
  centerBlock: {
    flex: 1,
    marginLeft: theme.spacing.md,
    marginRight: theme.spacing.sm,
  },
  petName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.semibold,
  },
  petMeta: {
    marginTop: theme.spacing.xs,
    fontFamily: 'Inter-Regular',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  iconHit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginLeft: 68,
    backgroundColor: theme.colors.border.light,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.secondary.light,
    textAlign: 'center',
  },
  emptyAddButton: {
    minHeight: theme.components.button.minHeight,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.components.button.borderRadius,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.card.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAddText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.medium,
  },
  addButton: {
    marginTop: theme.spacing.xl,
    marginVertical: theme.spacing.md + theme.spacing.sm,
    minHeight: theme.components.button.minHeight,
    borderRadius: theme.components.button.borderRadius,
    backgroundColor: theme.colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.components.button.primaryText,
    fontWeight: theme.fontWeights.semibold,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.82,
  },
});
