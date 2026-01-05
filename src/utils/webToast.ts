import { Platform } from "react-native";

export type WebToastTone = "info" | "success" | "warning" | "error";

export type WebToastPayload = {
  title: string;
  message: string;
  tone?: WebToastTone;
  durationMs?: number;
};

export type WebToastListener = (toast: WebToastPayload) => void;

// Houd listeners bij zodat verschillende schermen dezelfde toasts kunnen ontvangen.
const listeners = new Set<WebToastListener>();

// Stuur een toast naar alle geregistreerde listeners (alleen op web actief).
export const pushWebToast = (toast: WebToastPayload) => {
  if (Platform.OS !== "web") {
    return;
  }
  listeners.forEach((listener) => listener(toast));
};

// Registreer een listener; retourneert een cleanup functie om memory leaks te voorkomen.
export const subscribeWebToast = (listener: WebToastListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
