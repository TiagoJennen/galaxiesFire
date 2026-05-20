export type LatLng = {
  latitude: number;
  longitude: number;
};

export type ListSource = "active" | "archive";

// Subtaken erven dezelfde metadata als hoofdtaak, maar met eigen status en locatie.
export interface SubTodo {
  text: string;

  done: boolean;

  deadline?: string | null;

  image?: string | null;

  createdAt?: string | null;

  priority?: "low" | "medium" | "high" | null;

  location?: LatLng | null;

  locationDescription?: string | null;
}

// Hoofdtaak waar subtaken en extra metadata aan gekoppeld worden.
export interface Todo {
  text: string;

  done: boolean;

  description?: string | null;

  deadline?: string | null;

  subtasks: SubTodo[];

  image?: string | null;

  createdAt?: string | null;

  priority?: "low" | "medium" | "high" | null;

  location?: LatLng | null;

  locationDescription?: string | null;
}

export interface ListScreenProps {
  theme: "light" | "dark";

  toggleTheme: () => void;

  language: "nl" | "en";

  toggleLanguage: () => void;
}
