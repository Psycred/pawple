import React, { useCallback, useEffect, useState } from 'react';
import { blockPet } from '../services/blocks';
import PawpleConfirmModal from './PawpleConfirmModal';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Quiet confirm before blocking another pet profile.
 */
export default function BlockConfirmSheet({
  visible,
  pet,
  onClose,
  onBlocked,
}) {
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [done, setDone] = useState(false);

  const petName = String(pet?.name ?? '').trim() || 'this pet';

  useEffect(() => {
    if (!visible) {
      setDone(false);
      setErrorText('');
      setBusy(false);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (busy) {
      return;
    }
    setErrorText('');
    setDone(false);
    onClose?.();
  }, [busy, onClose]);

  const handleConfirm = useCallback(async () => {
    const petId = String(pet?.id ?? '');
    if (!petId || busy) {
      return;
    }
    if (!UUID_RE.test(petId)) {
      setErrorText('This pet cannot be blocked.');
      return;
    }
    setBusy(true);
    setErrorText('');
    try {
      await blockPet(petId);
      setDone(true);
      onBlocked?.(pet);
    } catch (e) {
      console.error('[BlockConfirmSheet]', e);
      setErrorText('Could not block right now.');
    } finally {
      setBusy(false);
    }
  }, [busy, onBlocked, pet]);

  if (done) {
    return (
      <PawpleConfirmModal
        visible={visible}
        mode="single"
        title="Blocked"
        body={`${petName} won't show in your feed.`}
        confirmLabel="Done"
        showIcon={false}
        onClose={handleClose}
        onConfirm={handleClose}
      />
    );
  }

  return (
    <PawpleConfirmModal
      visible={visible}
      busy={busy}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={`Block ${petName}?`}
      body={`Hide ${petName} from your feed. You can undo this in Settings.`}
      errorText={errorText}
      cancelLabel="Cancel"
      confirmLabel="Block"
      icon="slash"
      iconTone="caution"
      confirmTone="sage"
    />
  );
}
