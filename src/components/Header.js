import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../config/supabase';
import { theme } from '../config/theme';
import { useActivePet } from '../contexts/ActivePetContext';
import PetContextSelector from './PetContextSelector';

const OPEN_CLOSE_DEBOUNCE_MS = 120;

function Header({ rightAccessory }) {
  const { activePetId, setPet } = useActivePet();
  const [pets, setPets] = useState([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [petsLoading, setPetsLoading] = useState(false);
  const debounceRef = useRef(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(24)).current;

  const activePet = pets.find((pet) => pet.id === activePetId) ?? null;
  const activePetName = activePet?.name || 'Select pet';

  const fetchPets = useCallback(async () => {
    setPetsLoading(true);
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
      setPets((data || []).map((pet) => ({ id: pet.id, name: pet.name || 'Unnamed pet', photo_url: pet.photo_url })));
    } catch (error) {
      console.log('[Header] Pets fetch error', error);
      setPets([]);
    } finally {
      setPetsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const debouncedToggle = useCallback((nextVisible) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSheetVisible(nextVisible);
    }, OPEN_CLOSE_DEBOUNCE_MS);
  }, []);

  const handleOpen = () => {
    fetchPets();
    debouncedToggle(true);
  };

  const handleClose = () => {
    debouncedToggle(false);
  };

  const handleSelectPet = async (pet) => {
    await setPet(String(pet.id));
    console.log(`[Header] Pet switched to ${pet.id}`);
    AccessibilityInfo.announceForAccessibility?.(`Switched to ${pet.name}`);
    handleClose();
  };

  useEffect(() => {
    if (sheetVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0.35, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetY, {
          toValue: 0,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    backdropOpacity.setValue(0);
    sheetY.setValue(24);
  }, [backdropOpacity, sheetVisible, sheetY]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.row}>
        <Pressable
          onPress={handleOpen}
          style={({ pressed }) => [styles.selector, pressed && styles.selectorPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Active pet ${activePetName}. Open pet selector.`}
          accessibilityHint="Opens your pet list"
        >
          <PetContextSelector photo_url={activePet?.photo_url} size={32} style={styles.avatar} />
          <Text style={styles.name} numberOfLines={1}>
            {activePetName}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.text.muted.light} />
        </Pressable>
        <View style={styles.spacer} />
        {rightAccessory ? <View style={styles.right}>{rightAccessory}</View> : null}
      </View>

      <Modal visible={sheetVisible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Close pet selector">
            <Animated.View style={[styles.modalBackdrop, { opacity: backdropOpacity }]} />
          </Pressable>
          <Animated.View style={[styles.modalCard, { transform: [{ translateY: sheetY }] }]} accessibilityRole="menu">
            <Text style={styles.modalTitle}>Your pets</Text>
            {petsLoading ? (
              <Text style={styles.helperText}>Loading pets...</Text>
            ) : (
              <FlatList
                data={pets}
                keyExtractor={(item) => String(item.id)}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => {
                  const selected = String(item.id) === String(activePetId);
                  return (
                    <Pressable
                      onPress={() => handleSelectPet(item)}
                      style={({ pressed }) => [styles.itemRow, selected && styles.itemRowSelected, pressed && styles.itemRowPressed]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Switch to ${item.name}`}
                    >
                      <PetContextSelector photo_url={item.photo_url} size={32} />
                      <Text style={styles.itemName}>{item.name}</Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={<Text style={styles.helperText}>No pets yet. Add one to continue.</Text>}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default memo(Header);

const styles = StyleSheet.create({
  safe: {
    backgroundColor: theme.colors.background.light,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md + theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg + theme.spacing.sm,
    backgroundColor: theme.colors.background.light,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.light,
  },
  selector: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  selectorPressed: {
    opacity: 0.86,
  },
  avatar: {
    marginRight: theme.spacing.sm,
  },
  name: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.semibold,
    marginRight: theme.spacing.xs,
  },
  spacer: {
    flex: 1,
  },
  right: {
    marginLeft: theme.spacing.md,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.text.primary.light,
  },
  modalCard: {
    maxHeight: '70%',
    backgroundColor: theme.colors.card.light,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    ...theme.shadowsRN.sm,
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.md,
  },
  helperText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.muted.light,
    paddingVertical: theme.spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.light,
  },
  itemRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  itemRowSelected: {
    backgroundColor: theme.colors.background.light,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
  },
  itemRowPressed: {
    opacity: 0.85,
  },
  itemName: {
    marginLeft: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.medium,
  },
});
