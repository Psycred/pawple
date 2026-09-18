import React from 'react';
import PawpleConfirmModal from './PawpleConfirmModal';

const COPY = {
  logout_confirm: {
    title: 'Leaving Pawple?',
    lead: "We'll miss you and your pet.",
    body: 'You can always come back.',
    confirmLabel: 'Log out',
    cancelLabel: 'Stay',
    icon: 'log-out',
    iconTone: 'neutral',
    confirmTone: 'sage',
  },
  delete_confirm: {
    title: 'Leaving these memories behind?',
    lead: 'Your pet will always have a place here.',
    body: "If you're sure you want to leave Pawple, we'll delete your account and its data.",
    confirmLabel: 'Delete my account',
    cancelLabel: 'Keep my account',
    icon: 'trash-2',
    iconTone: 'caution',
    confirmTone: 'danger',
  },
  delete_success: {
    title: "We'll miss you. ❤️",
    lead: 'Thank you for being part of Pawple.',
    body: null,
    confirmLabel: 'Close',
    icon: 'heart',
    iconTone: 'neutral',
    confirmTone: 'sage',
  },
};

/**
 * Calm confirmation and goodbye moments for logout and account deletion.
 */
export default function AccountLifecycleModal({
  visible,
  variant,
  busy = false,
  errorText = '',
  onClose,
  onConfirm,
}) {
  const copy = COPY[variant] ?? COPY.logout_confirm;
  const isSuccess = variant === 'delete_success';

  return (
    <PawpleConfirmModal
      visible={visible}
      busy={busy}
      onClose={onClose}
      onConfirm={isSuccess ? onClose : onConfirm}
      title={copy.title}
      lead={copy.lead}
      body={copy.body}
      errorText={errorText}
      cancelLabel={copy.cancelLabel}
      confirmLabel={copy.confirmLabel}
      icon={copy.icon}
      iconTone={copy.iconTone}
      confirmTone={copy.confirmTone}
      mode={isSuccess ? 'single' : 'confirm'}
      showIcon={!isSuccess}
    />
  );
}
