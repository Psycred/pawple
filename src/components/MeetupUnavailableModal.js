import React from 'react';
import PawpleConfirmModal from './PawpleConfirmModal';

/** Shown when a Host/Joined card points at a meetup that no longer exists. */
export default function MeetupUnavailableModal({ visible, onClose }) {
  return (
    <PawpleConfirmModal
      visible={visible}
      onClose={onClose}
      onConfirm={onClose}
      title="Meetup not available anymore"
      confirmLabel="OK"
      mode="single"
      icon="calendar"
      iconTone="neutral"
      showIcon={false}
    />
  );
}
