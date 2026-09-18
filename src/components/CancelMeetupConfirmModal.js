import React from 'react';
import PawpleConfirmModal from './PawpleConfirmModal';

/** Meetup host cancellation — thin wrapper over the shared Pawple confirm card. */
export default function CancelMeetupConfirmModal({
  visible,
  busy = false,
  onClose,
  onConfirm,
}) {
  return (
    <PawpleConfirmModal
      visible={visible}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Cancel this meetup?"
      body="It will be removed from everyone's plans."
      cancelLabel="Keep Meetup"
      confirmLabel="Yes, Cancel"
      icon="trash-2"
      iconTone="caution"
      confirmTone="sage"
    />
  );
}
