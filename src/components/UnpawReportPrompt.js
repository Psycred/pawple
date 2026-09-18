import React from 'react';
import {
  MATING_UNPAW_REPORT_NO,
  MATING_UNPAW_REPORT_PROMPT,
  MATING_UNPAW_REPORT_YES,
} from '../content/legalDocuments';
import PawpleConfirmModal from './PawpleConfirmModal';

/** Shown only after a successful Unpaw — optional report, not part of confirmation. */
export default function UnpawReportPrompt({ visible, petName: _petName, onNo, onYes }) {
  return (
    <PawpleConfirmModal
      visible={visible}
      onClose={onNo}
      onConfirm={onYes}
      title={MATING_UNPAW_REPORT_PROMPT}
      cancelLabel={MATING_UNPAW_REPORT_NO}
      confirmLabel={MATING_UNPAW_REPORT_YES}
      icon="flag"
      iconTone="neutral"
      confirmTone="sage"
    />
  );
}
