import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 1. Konfigurasi Firebase dari Environment Variables
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Audit & Validasi Variabel Lingkungan
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID'
];

const missingVars = requiredEnvVars.filter((key) => !import.meta.env[key]);

if (missingVars.length > 0) {
  console.error(`[Firebase Config Error] Variabel .env berikut tidak ditemukan: ${missingVars.join(', ')}.`);
}

// 3. Inisialisasi Firebase App dengan Proteksi SSR & Singleton Pattern
const isBrowser = typeof window !== "undefined";

let app;
if (isBrowser || getApps().length > 0) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

// 4. Ekspor Layanan Firebase
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

// 5. Aktifkan Offline Persistence (Hanya di Client-side Browser)
if (isBrowser && db) {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore Persistence] Multi-tab persistence failed: Tab lain sedang aktif.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore Persistence] Browser ini tidak mendukung offline persistence.');
    } else {
      console.error('[Firestore Persistence Error]', err);
    }
  });
}

export default app;