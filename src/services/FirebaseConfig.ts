// Kijkt of de app op web of mobiel draait
import { Platform } from "react-native";

// Start Firebase in de app
import { getApp, getApps, initializeApp } from "firebase/app";

// Type voor het login systeem van Firebase
import type { Auth } from "firebase/auth";

// Functies voor login en gebruikersbeheer
import {
  initializeAuth,
  getAuth,
  setPersistence,
  inMemoryPersistence,
} from "firebase/auth";

// Lokale opslag voor mobiele apparaten
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firestore database import
import { getFirestore } from "firebase/firestore";

// Firebase project instellingen
// Hiermee maakt de app verbinding met mijn Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyBxxtGYB3xq0j0mjCZYoKJMweuEtZzEUJE",
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

// Start Firebase met de instellingen hierboven
// Bij hot reload kan dit bestand opnieuw laden; hergebruik dan bestaande app.
export const FIREBASE_APP = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// Variabele voor het Firebase login systeem
let FIREBASE_AUTH: Auth;

// Controleer op welk platform de app draait
// Web en mobiel gebruiken een andere manier om login op te slaan
if (Platform.OS === "web") {
  // Haal het login systeem op
  const auth = getAuth(FIREBASE_APP);

  // Gebruik alleen geheugenpersistence zodat een herstart altijd opnieuw inlogt.
  setPersistence(auth, inMemoryPersistence).catch((error) => {
    console.log("Fout bij opslaan login:", error);
  });

  // Sla de auth instantie op
  FIREBASE_AUTH = auth;
  console.log("Firebase auth initialized (web)");
} else {
  try {
    FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
      persistence: inMemoryPersistence,
    });
    console.log("Firebase auth initialized (native)");
  } catch (error: any) {
    // initializeAuth mag maar 1x per app gebeuren; bij hot reload pakken we bestaande auth.
    if (error?.code === "auth/already-initialized") {
      FIREBASE_AUTH = getAuth(FIREBASE_APP);
    } else {
      throw error;
    }
  }
}

// Export van het login systeem
// Andere bestanden kunnen dit gebruiken voor login en registratie
export { FIREBASE_AUTH };

// Start de Firestore database
// Hier worden taken en gebruikersdata opgeslagen
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
