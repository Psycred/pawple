import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../config/theme';
import { useRuntimeThemeColors } from '../hooks/useRuntimeThemeColors';

const SAGE = '#9EB8A0';

function ParticipantRow({ pet, onBlock, surfaces }) {
  const initial = pet?.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <View style={[styles.row, { borderBottomColor: surfaces.meetupCardBorder }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial} allowFontScaling>
          {initial}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text
          style={[styles.petName, { color: surfaces.profileHeroNameColor }]}
          numberOfLines={1}
          allowFontScaling
        >
          {pet?.name || 'Pet'}
        </Text>
        {pet?.breed ? (
          <Text
            style={[styles.petBreed, { color: surfaces.meetupMetaText }]}
            numberOfLines={1}
            allowFontScaling
          >
            {pet.breed}
          </Text>
        ) : null}
      </View>
      {onBlock ? (
        <Pressable
          onPress={() => onBlock(pet)}
          hitSlop={8}
          style={({ pressed }) => [styles.blockBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Block ${pet?.name || 'pet'}`}
        >
          <Text style={[styles.blockBtnText, { color: surfaces.meetupMetaText }]} allowFontScaling>
            Block
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Bottom sheet listing all meetup participants.
 * Optional per-row Block for other pets (PAW-47).
 */
export default function ParticipantModal({
  visible,
  count = 0,
  participants = [],
  ownedPetIds = [],
  onBlockPet,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const surfaces = useRuntimeThemeColors();
  const owned = new Set((ownedPetIds ?? []).map(String));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close participants" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: surfaces.meetupCardBackground,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: surfaces.meetupCardBorder }]} />
        <Text style={[styles.title, { color: surfaces.profileHeroNameColor }]} allowFontScaling>
          {`Participants (${count})`}
        </Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {participants.length === 0 ? (
            <Text style={[styles.emptyText, { color: surfaces.meetupMetaText }]} allowFontScaling>
              No one has joined yet.
            </Text>
          ) : (
            participants.map((pet) => {
              const canBlock =
                typeof onBlockPet === 'function' &&
                pet?.id &&
                !owned.has(String(pet.id));
              return (
                <ParticipantRow
                  key={String(pet.id)}
                  pet={pet}
                  surfaces={surfaces}
                  onBlock={canBlock ? onBlockPet : undefined}
                />
              );
            })
          )}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeButtonText} allowFontScaling>
            Close
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 20,
    marginBottom: 12,
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SAGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    color: '#FFFFFF',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
  },
  petBreed: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    marginTop: 2,
  },
  blockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  blockBtnText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    paddingVertical: 24,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SAGE,
  },
  closeButtonText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.88,
  },
});
