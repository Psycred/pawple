import React from 'react';
import LegalDocumentView from '../components/LegalDocumentView';
import { privacySections } from '../content/legalDocuments';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentView title="Privacy Policy" sections={privacySections} />;
}
