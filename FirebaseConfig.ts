import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBxxtGYB3xq0j0mjCZYoKJMweuEtZzEUJE",
  authDomain: "login-bf5c2.firebaseapp.com",
  projectId: "login-bf5c2",
  storageBucket: "login-bf5c2.firebasestorage.app",
  messagingSenderId: "849024349264",
  appId: "1:849024349264:web:00ea0d5fe71dc3aa38cd55",
};

export const FIREBASE_APP = initializeApp(firebaseConfig);
export const FIREBASE_AUTH = getAuth(FIREBASE_APP);
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
