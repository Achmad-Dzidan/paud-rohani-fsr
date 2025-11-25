import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAGAvr1QAO5ZPPCtbYQLK_0694DEjoy5Bw",
  authDomain: "paud-rohani.firebaseapp.com",
  projectId: "paud-rohani",
  storageBucket: "paud-rohani.firebaseapp.com",
  messagingSenderId: "1051220684882",
  appId: "1:1051220684882:web:7d77a8367fa92b57c96f8b",
  measurementId: "G-SQHBZ6ST71"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
