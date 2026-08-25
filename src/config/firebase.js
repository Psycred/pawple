import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Paste your real Firebase project keys below.
// You can find these in Firebase Console -> Project settings -> General -> Your apps.
const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY',
  authDomain: 'PASTE_YOUR_AUTH_DOMAIN',
  projectId: 'PASTE_YOUR_PROJECT_ID',
  storageBucket: 'PASTE_YOUR_STORAGE_BUCKET',
  messagingSenderId: 'PASTE_YOUR_MESSAGING_SENDER_ID',
  appId: 'PASTE_YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);

// Export Auth for sign-in flows and Firestore for app data reads/writes.
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
