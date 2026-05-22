// Controleert of de app op web of native draait
import { Platform } from "react-native";

// Initialiseer de Firebase-app
import { getApp, getApps, initializeApp } from "firebase/app";

// Type voor de Firebase auth-instantie
import type { Auth } from "firebase/auth";

// Functies voor authenticatie en gebruikersbeheer
import {
  initializeAuth,
  getAuth,
  setPersistence,
  inMemoryPersistence,
} from "firebase/auth";

// Lokale opslag voor mobiele apparaten
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firestore-database import
import { getFirestore } from "firebase/firestore";

// Firebase projectinstellingen
// Instellingen om de app met het Firebase-project te verbinden
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

// Initialiseer Firebase met bovenstaande instellingen
// Bij hot reload kan dit bestand opnieuw worden geëvalueerd; hergebruik de bestaande app-instantie.
export const FIREBASE_APP = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// Variabele voor de Firebase auth-instantie
let FIREBASE_AUTH: Auth;

// Detecteer op welk platform de app draait
// Web en native gebruiken verschillende persistence-strategieën voor auth
if (Platform.OS === "web") {
  // Haal de auth-instantie op
  const auth = getAuth(FIREBASE_APP);

  // Gebruik in-memory persistence zodat herstarts altijd opnieuw inloggen vereisen.
  setPersistence(auth, inMemoryPersistence).catch((error) => {
    console.log("Fout bij opslaan login:", error);
  });

  // Sla de auth-instantie op
  FIREBASE_AUTH = auth;
  console.log("Firebase auth initialized (web)");
} else {
  try {
    FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
      persistence: inMemoryPersistence,
    });
    console.log("Firebase auth initialized (native)");
  } catch (error: any) {
    // initializeAuth mag maar 1x per app aangeroepen worden; bij hot reload gebruik bestaande auth.
    if (error?.code === "auth/already-initialized") {
      FIREBASE_AUTH = getAuth(FIREBASE_APP);
    } else {
      throw error;
    }
  }
}

// Exporteer de auth-instantie
// Andere bestanden kunnen deze gebruiken voor aanmelding en registratie
export { FIREBASE_AUTH };

// Initialiseer de Firestore-database
// Taken en gebruikersdata worden hier opgeslagen
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
