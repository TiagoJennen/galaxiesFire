import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

// Firebase configuratie
const firebaseConfig = {
  apiKey: "AIzaSyBxxtGYB3xq0j0mjCZYoKJMweuEtZzEUJE",
  authDomain: "login-bf5c2.firebaseapp.com",
  projectId: "login-bf5c2",
  storageBucket: "login-bf5c2.firebasestorage.app",
  messagingSenderId: "849024349264",
  appId: "1:849024349264:web:00ea0d5fe71dc3aa38cd55",
};

// Initialize app
export const FIREBASE_APP = initializeApp(firebaseConfig);

// Gebruik require om getReactNativePersistence veilig te importeren
// Dit voorkomt TypeScript-importfouten
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require("firebase/auth");

// Initialize Auth met AsyncStorage (persistentie)
export const FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
