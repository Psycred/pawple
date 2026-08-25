import React, { useEffect, useRef } from 'react';
import { Animated, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import PetContextSelector from './PetContextSelector';

const { avatarSize } = theme.feed;

/**
 * Bottom sheet: pick active pet, optional add-pet entry point.
 */
export default function PetSwitchBottomSheet({
  visible,
  pets,
  activePetId,
  onSelectPet,
  onClose,
  onAddPet,
}) {
  const insets = useSafeAreaInsets();
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      backdrop.setValue(0);
      sheetY.setValue(320);
    }
  }, [visible, backdrop, sheetY]);

  const closeAnimated = (then) => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: 320, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished && then) {
        then();
      }
    });
  };

  const handleSelect = (petId) => {
    onSelectPet(petId);
    closeAnimated(onClose);
  };

  const handleAdd = () => {
    closeAnimated(() => {
      onClose();
      onAddPet?.();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeAnimated(onClose)}>
      <View style={styles.root}>
        <Pressable style={styles.backdropPress} onPress={() => closeAnimated(onClose)} accessibilityLabel="Close">
          <Animated.View
            pointerEvents="none"
            style={[styles.backdropFill, { opacity: backdrop }]}
          />
        </Pressable>
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, theme.spacing.md),
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          <Text style={styles.sheetTitle}>Your pets</Text>
          <FlatList
            data={pets}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => {
              const active = item.id === activePetId;
              return (
                <Pressable
                  style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.rowPressed]}
                  onPress={() => handleSelect(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${item.name}${active ? ', currently selected' : ''}`}
                >
                  <PetContextSelector
                    photoUrl={item.avatarUrl ?? item.photo_url}
                    size={avatarSize + 4}
                    style={styles.rowAvatar}
                  />
                  <Text style={styles.rowName}>{item.name}</Text>
                </Pressable>
              );
            }}
          />
          <Pressable
            onPress={handleAdd}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add another pet"
          >
            <Text style={styles.addBtnText}>+ Add Another Pet</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: theme.colors.card.light,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    maxHeight: '72%',
    ...theme.shadowsRN.sm,
  },
  sheetTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    marginBottom: theme.spacing.md,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.light,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    minHeight: 56,
  },
  rowActive: {
    backgroundColor: theme.colors.background.light,
    marginHorizontal: -theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowAvatar: {
    marginRight: theme.spacing.md,
  },
  rowName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary.light,
    fontWeight: theme.fontWeights.medium,
  },
  addBtn: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnPressed: {
    opacity: 0.75,
  },
  addBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.primary.light,
    fontWeight: theme.fontWeights.semibold,
  },
});
