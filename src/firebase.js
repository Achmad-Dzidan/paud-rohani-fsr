import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 1. Konfigurasi dari Environment Variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Validasi Kredensial
const requiredEnvVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'];
const missingVars = requiredEnvVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0) {
  console.error(`[Firebase Initialization] Error: Variabel .env berikut hilang: ${missingVars.join(', ')}`);
}

// 3. Inisialisasi Singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 4. Inisialisasi Layanan
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 5. Opsional: Mengaktifkan Firestore Persistence untuk pengalaman Offline
// Dibalut dalam try-catch agar tidak crash di environment yang tidak mendukung
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore: Multiple tabs open, persistence disabled in secondary tabs.");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore: The current browser does not support persistence.");
    }
  });
}

export { app, auth, db, storage };