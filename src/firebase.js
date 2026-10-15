import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
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
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter((key) => !import.meta.env[key]);
if (missingVars.length > 0) {
  console.warn(
    `[Firebase Config Warning] Variabel .env berikut tidak ditemukan atau kosong: ${missingVars.join(', ')}.`
  );
}

// 3. Proteksi SSR & Safe Singleton Pattern
const isBrowser = typeof window !== "undefined";

function getFirebaseApp() {
  // Jika app sudah terinisialisasi, gunakan instance yang ada (Singleton)
  if (getApps().length > 0) {
    return getApp();
  }
  
  // Inisialisasi app baru di Browser atau jika konfigurasi minimal tersedia
  if (isBrowser || (firebaseConfig.apiKey && firebaseConfig.projectId)) {
    return initializeApp(firebaseConfig);
  }
  
  return null;
}

const app = getFirebaseApp();

// 4. Ekspor Layanan Firebase (Safe Instances)
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

// 5. Offline Persistence Firestore dengan Fallback (Client-side Only)
if (isBrowser && db) {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore Persistence] Multi-tab persistence failed: Tab lain sedang aktif.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore Persistence] Multi-tab tidak didukung, mencoba single-tab fallback...');
      enableIndexedDbPersistence(db).catch((singleErr) => {
        console.warn('[Firestore Persistence] Single-tab persistence fallback gagal:', singleErr.message);
      });
    } else {
      console.error('[Firestore Persistence Error]', err);
    }
  });
}

export default app;