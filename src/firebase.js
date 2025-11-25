
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAGAvr1QAO5ZPPCtbYQLK_0694DEjoy5Bw",
  authDomain: "paud-rohani.firebaseapp.com",
  projectId: "paud-rohani",
  storageBucket: "paud-rohani.firebasestorage.app",
  messagingSenderId: "1051220684882",
  appId: "1:1051220684882:web:7d77a8367fa92b57c96f8b",
  measurementId: "G-SQHBZ6ST71"
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
