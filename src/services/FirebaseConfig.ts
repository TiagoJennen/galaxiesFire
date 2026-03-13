// Kijkt of de app op web of mobiel draait
import { Platform } from "react-native";

// Start Firebase in de app
import { initializeApp } from "firebase/app";

// Type voor het login systeem van Firebase
import type { Auth } from "firebase/auth";

// Functies voor login en gebruikersbeheer
import {
  initializeAuth,
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

// Lokale opslag voor mobiele apparaten
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firestore database import
import { getFirestore } from "firebase/firestore";

// Firebase project instellingen
// Hiermee maakt de app verbinding met mijn Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyBxxxtGYB3xq0j0mjCZYokJMweuEtZzEUJF",
  authDomain: "login-bf5c2.firebaseapp.com",
  projectId: "login-bf5c2",
  storageBucket: "login-bf5c2.firebasestorage.app",
  messagingSenderId: "849024349264",
  appId: "1:849024349264:web:00ea0d5fe71dc3aa38cd55",
};

// Start Firebase met de instellingen hierboven
export const FIREBASE_APP = initializeApp(firebaseConfig);

// Variabele voor het Firebase login systeem
let FIREBASE_AUTH: Auth;

// Controleer op welk platform de app draait
// Web en mobiel gebruiken een andere manier om login op te slaan
if (Platform.OS === "web") {
  // Haal het login systeem op
  const auth = getAuth(FIREBASE_APP);

  // Zorg dat de gebruiker ingelogd blijft in de browser
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.log("Fout bij opslaan login:", error);
  });

  // Sla de auth instantie op
  FIREBASE_AUTH = auth;
} else {
  // Op mobiel gebruiken we AsyncStorage
  // Dit slaat de login gegevens lokaal op op de telefoon
  const { getReactNativePersistence } = require("firebase/auth");

  FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// Export van het login systeem
// Andere bestanden kunnen dit gebruiken voor login en registratie
export { FIREBASE_AUTH };

// Start de Firestore database
// Hier worden taken en gebruikersdata opgeslagen
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
