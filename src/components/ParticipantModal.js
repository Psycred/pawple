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

const SCREEN_BG = '#FFFCF8';
const PRIMARY_TEXT = '#3A312E';
const SECONDARY_TEXT = '#6B625C';
const DIVIDER = '#F1E8DF';
const SAGE = '#9EB8A0';

function ParticipantRow({ pet }) {
  const initial = pet?.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial} allowFontScaling>
          {initial}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.petName} numberOfLines={1} allowFontScaling>
          {pet?.name || 'Pet'}
        </Text>
        {pet?.breed ? (
          <Text style={styles.petBreed} numberOfLines={1} allowFontScaling>
            {pet.breed}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Bottom sheet listing all meetup participants.
 */
export default function ParticipantModal({ visible, count = 0, participants = [], onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close participants" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.handle} />
        <Text style={styles.title} allowFontScaling>
          {`Participants (${count})`}
        </Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {participants.length === 0 ? (
            <Text style={styles.emptyText} allowFontScaling>
              No one has joined yet.
            </Text>
          ) : (
            participants.map((pet) => (
              <ParticipantRow key={String(pet.id)} pet={pet} />
            ))
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
    backgroundColor: SCREEN_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '72%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: DIVIDER,
    marginBottom: 20,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: PRIMARY_TEXT,
    marginBottom: 16,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    color: SAGE,
  },
  rowText: {
    flex: 1,
  },
  petName: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: PRIMARY_TEXT,
  },
  petBreed: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: SECONDARY_TEXT,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: SECONDARY_TEXT,
    paddingVertical: 16,
  },
  closeButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5EE',
  },
  closeButtonText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: SAGE,
  },
  pressed: {
    opacity: theme.opacity.pressedUi,
  },
});
