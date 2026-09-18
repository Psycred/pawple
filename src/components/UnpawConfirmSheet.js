import React from 'react';
import {
  MATING_UNPAW_CONFIRM_ACTION,
  MATING_UNPAW_CONFIRM_BODY,
  MATING_UNPAW_CONFIRM_CANCEL,
  MATING_UNPAW_CONFIRM_TITLE,
} from '../content/legalDocuments';
import PawpleConfirmModal from './PawpleConfirmModal';

/** Calm confirmation before ending a reversible Mating connection. */
export default function UnpawConfirmSheet({
  visible,
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <PawpleConfirmModal
      visible={visible}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
      title={MATING_UNPAW_CONFIRM_TITLE}
      body={MATING_UNPAW_CONFIRM_BODY}
      cancelLabel={MATING_UNPAW_CONFIRM_CANCEL}
      confirmLabel={MATING_UNPAW_CONFIRM_ACTION}
      icon="heart"
      iconTone="neutral"
      confirmTone="sage"
    />
  );
}
