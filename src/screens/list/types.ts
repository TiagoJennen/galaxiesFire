/**
 * GPS-coördinaten (latitude/longitude).
 * Gebruikt voor locatiegebonden taken en geofences.
 */
export type LatLng = {
  latitude: number;
  longitude: number;
};

/**
 * Geeft aan uit welke lijst een taak komt.
 * "active"  → huidige taken
 * "archive" → afgeronde of gearchiveerde taken
 */
export type ListSource = "active" | "archive";

/**
 * Structuur van een subtaken-item binnen een Todo.
 * Subtaken kunnen hun eigen status, prioriteit en locatie hebben.
 */
export interface SubTodo {
  /** Titel/omschrijving van de subtaak */
  text: string;

  /** Status van de subtaak */
  done: boolean;

  /** Optionele deadline als ISO-string */
  deadline?: string | null;

  /** Optionele afbeelding (bijv. als base64 of URI) */
  image?: string | null;

  /** Aanmaakdatum van de subtaak */
  createdAt?: string | null;

  /** Prioriteitsniveau van de subtaak */
  priority?: "low" | "medium" | "high" | null;

  /** Optionele locatie waar de subtaak uitgevoerd moet worden */
  location?: LatLng | null;

  /** Beschrijvende tekst van de locatie (bv. “thuis”, “winkel”) */
  locationDescription?: string | null;
}

/**
 * Hoofdstructuur voor een taak in de app.
 * Bevat subtaken, metadata en optionele locatie-informatie.
 */
export interface Todo {
  /** Titel/omschrijving van de taak */
  text: string;

  /** Status van de taak */
  done: boolean;

  /** Optionele deadline als ISO-string */
  deadline?: string | null;

  /** Lijst met subtaken */
  subtasks: SubTodo[];

  /** Optionele afbeelding gekoppeld aan de taak */
  image?: string | null;

  /** Aanmaakdatum van de taak */
  createdAt?: string | null;

  /** Prioriteitsniveau van de taak */
  priority?: "low" | "medium" | "high" | null;

  /** Optionele geolocatie van waar de taak moet gebeuren */
  location?: LatLng | null;

  /** Tekstuele beschrijving van de locatie */
  locationDescription?: string | null;
}

/**
 * Props die doorgegeven worden aan het lijstscherm.
 * Bevat interface-voorkeuren van de gebruiker.
 */
export interface ListScreenProps {
  /** Huidig actieve thema */
  theme: "light" | "dark";

  /** Toggle-functie om thema te wisselen */
  toggleTheme: () => void;

  /** Gekozen taal voor de interface */
  language: "nl" | "en";

  /** Toggle-functie om taal te wisselen */
  toggleLanguage: () => void;
}
