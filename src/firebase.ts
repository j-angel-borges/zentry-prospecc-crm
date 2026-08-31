import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD36pVBqXzjlxSXmQD0LhVvJpQtvEp1xmk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "zentryos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "zentryos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "zentryos.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "730964985085",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:730964985085:web:56ebd3ff12561d14566a94",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-11XVW06M82"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const LEADS_COLLECTION = 'leads_expo_maternidad';

export { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, query, orderBy, Timestamp };
