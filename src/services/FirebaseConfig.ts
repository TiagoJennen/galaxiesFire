// Checks whether the app is running on web or native
import { Platform } from "react-native";

// Initialize Firebase app
import { getApp, getApps, initializeApp } from "firebase/app";

// Type for the Firebase auth instance
import type { Auth } from "firebase/auth";

// Functions for authentication and user management
import {
  initializeAuth,
  getAuth,
  setPersistence,
  inMemoryPersistence,
} from "firebase/auth";

// Local storage for mobile devices
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firestore database import
import { getFirestore } from "firebase/firestore";

// Firebase project settings
// Settings used to connect the app to the Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyCB2iYs9TQGI-B2splUUKNDy2zDh8KyFEs",
  authDomain: "login-bf5c2.firebaseapp.com",
  projectId: "login-bf5c2",
  storageBucket: "login-bf5c2.firebasestorage.app",
  messagingSenderId: "849024349264",
  appId: "1:849024349264:web:00ea0d5fe71dc3aa38cd55",
};

const looksLikePlaceholderApiKey = /x{3,}/i.test(firebaseConfig.apiKey);
if (looksLikePlaceholderApiKey) {
  console.warn(
    "Firebase apiKey lijkt een placeholder te bevatten. Controleer src/services/FirebaseConfig.ts.",
  );
}

// Initialize Firebase with the settings above
// During hot reload this file may be re-evaluated; reuse existing app instance.
export const FIREBASE_APP = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// Variable for the Firebase auth instance
let FIREBASE_AUTH: Auth;

// Detect which platform the app is running on
// Web and native use different persistence strategies for auth
if (Platform.OS === "web") {
  // Get the auth instance
  const auth = getAuth(FIREBASE_APP);

  // Use in-memory persistence so restarts always require re-login.
  setPersistence(auth, inMemoryPersistence).catch((error) => {
    console.log("Fout bij opslaan login:", error);
  });

  // Store the auth instance
  FIREBASE_AUTH = auth;
  console.log("Firebase auth initialized (web)");
} else {
  try {
    FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
      persistence: inMemoryPersistence,
    });
    console.log("Firebase auth initialized (native)");
  } catch (error: any) {
    // initializeAuth can only be called once per app; on hot reload use existing auth.
    if (error?.code === "auth/already-initialized") {
      FIREBASE_AUTH = getAuth(FIREBASE_APP);
    } else {
      throw error;
    }
  }
}

// Export the auth instance
// Other files can use this for sign-in and registration
export { FIREBASE_AUTH };

// Initialize Firestore database
// Tasks and user data are stored here
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
