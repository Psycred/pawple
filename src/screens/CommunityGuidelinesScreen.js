import React from 'react';
import LegalDocumentView from '../components/LegalDocumentView';
import { guidelinesSections } from '../content/legalDocuments';

/** Pawple Community Guidelines v1 — Founder (F). */
export default function CommunityGuidelinesScreen() {
  return <LegalDocumentView title="Community Guidelines" sections={guidelinesSections} />;
}
