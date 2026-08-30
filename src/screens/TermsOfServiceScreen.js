import React from 'react';
import LegalDocumentView from '../components/LegalDocumentView';
import { termsSections } from '../content/legalDocuments';

export default function TermsOfServiceScreen() {
  return <LegalDocumentView title="Terms of Service" sections={termsSections} />;
}
