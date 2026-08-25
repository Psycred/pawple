import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';

const DESTRUCTIVE = theme.colors.destructive?.light ?? theme.colors.error.light;

/**
 * Private CRUD surface for the current user's pets.
 */
export default function ManagePetsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { activePetId, setActivePetId } = useActivePet();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

      if (activePetId === petId) {
        const remaining = nextPets;
        const nextPet = remaining[0];
        if (nextPet) {
          setActivePetId(nextPet.id);
        } else {
          setActivePetId(null);
        }
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
    Alert.alert('Remove pet?', "This will delete this pet's profile and memories.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleDelete(petId) },
    ]);
  };

  const renderAvatar = (item) => {
    const initial = item?.name?.trim()?.charAt(0)?.toUpperCase() || '?';
    if (item?.photo_url) {
      return <Image source={{ uri: item.photo_url }} style={styles.avatarImage} />;
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
          <Text style={styles.petName} numberOfLines={1}>
            {item.name || 'Unnamed pet'}
          </Text>
          <Text style={styles.petMeta} numberOfLines={1}>
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
            <Ionicons name="pencil-outline" size={20} color={theme.colors.text.secondary.light} />
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
      {index < pets.length - 1 ? <View style={styles.divider} /> : null}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="paw-outline" size={theme.fontSizes.xxxl} color={theme.colors.text.muted.light} />
      <Text style={styles.emptyText}>No pets yet. Add your first friend!</Text>
      <Pressable
        style={({ pressed }) => [styles.emptyAddButton, pressed && styles.buttonPressed]}
        onPress={goToAdd}
        accessibilityRole="button"
        accessibilityLabel="Add pet"
      >
        <Text style={styles.emptyAddText}>+ Add Pet</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backHit, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Close manage pets"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary.light} />
        </Pressable>
        <Text style={styles.title}>Your Pets</Text>
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
