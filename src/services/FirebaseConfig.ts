import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import {
  initializeAuth,
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
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

let FIREBASE_AUTH: Auth;

if (Platform.OS === "web") {
  const auth = getAuth(FIREBASE_APP);
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.log("Failed to set web auth persistence:", error);
  });
  FIREBASE_AUTH = auth;
} else {
  // Gebruik require zodat bundlers voor web deze functie niet proberen te laden
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getReactNativePersistence } = require("firebase/auth");
  FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { FIREBASE_AUTH };

// Initialize Firestore
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
