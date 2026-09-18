import React, { useCallback, useEffect, useState } from 'react';
import {
  formatMatingDeleteChatConfirmBody,
  MATING_DELETE_CHAT_CONFIRM_ACTION,
  MATING_DELETE_CHAT_CONFIRM_CANCEL,
  MATING_DELETE_CHAT_CONFIRM_TITLE,
} from '../content/legalDocuments';
import { deleteOpenIntroductionChat } from '../services/mating';
import PawpleConfirmModal from './PawpleConfirmModal';

/** Calm destructive confirmation before deleting an open introduction chat. */
export default function DeleteChatConfirmSheet({
  visible,
  channelId,
  viewerPetId,
  petName,
  onClose,
  onDeleted,
}) {
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!visible) {
      setBusy(false);
      setErrorText('');
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (busy) {
      return;
    }
    setErrorText('');
    onClose?.();
  }, [busy, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!channelId || !viewerPetId || busy) {
      return;
    }
    setBusy(true);
    setErrorText('');
    try {
      await deleteOpenIntroductionChat(channelId, viewerPetId);
      onDeleted?.();
    } catch (e) {
      console.error('[DeleteChatConfirmSheet]', e);
      setErrorText("Couldn't delete this chat.");
    } finally {
      setBusy(false);
    }
  }, [busy, channelId, onDeleted, viewerPetId]);

  return (
    <PawpleConfirmModal
      visible={visible}
      busy={busy}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={MATING_DELETE_CHAT_CONFIRM_TITLE}
      body={formatMatingDeleteChatConfirmBody(petName)}
      errorText={errorText}
      cancelLabel={MATING_DELETE_CHAT_CONFIRM_CANCEL}
      confirmLabel={MATING_DELETE_CHAT_CONFIRM_ACTION}
      icon="trash-2"
      iconTone="caution"
      confirmTone="danger"
    />
  );
}
