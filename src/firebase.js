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

// 2. Validasi Variabel Lingkungan agar tidak terjadi silent fail
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

// 3. SSR Safe Guard & Singleton Pattern
const isBrowser = typeof window !== "undefined";

function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  
  // Pastikan inisialisasi hanya jika konfigurasi API key tersedia
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    return initializeApp(firebaseConfig);
  }
  
  return null;
}

const app = getFirebaseApp();

// 4. Eksport Layanan Firebase (Safe Instances)
// Jika app null (misal di sisi server atau config salah), instance akan bernilai null
// untuk mencegah error saat inisialisasi layanan oleh aplikasi.
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

// 5. Offline Persistence Firestore (Client-side Browser Only)
if (isBrowser && db) {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('[Firestore Persistence] Multi-tab persistence failed: Tab lain sedang aktif.');
    } else if (err.code === 'unimplemented') {
      // Fallback: The current browser does not support multi-tab, try single-tab
      console.info('[Firestore Persistence] Browser tidak mendukung multi-tab, mencoba fallback single-tab...');
      enableIndexedDbPersistence(db).catch((singleErr) => {
        console.error('[Firestore Persistence] Fallback single-tab persistence juga gagal:', singleErr.message);
      });
    } else {
      console.error('[Firestore Persistence Error]', err);
    }
  });
}

export default app;