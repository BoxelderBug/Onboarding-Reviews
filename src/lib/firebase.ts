import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

function getApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

let _db: Firestore | null = null;
let _auth: Auth | null = null;

export function getDb(): Firestore | null {
  if (_db) return _db;
  const app = getApp();
  if (!app) return null;
  _db = getFirestore(app);
  return _db;
}

export function getFirebaseAuth(): Auth | null {
  if (_auth) return _auth;
  const app = getApp();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}
