export type LatLng = {
  latitude: number;
  longitude: number;
};

export type ListSource = "active" | "archive";

export interface SubTodo {
  text: string;
  done: boolean;
  deadline?: string | null;
  image?: string | null;
  createdAt?: string | null;
  priority?: "low" | "medium" | "high" | null;
  location?: LatLng | null;
}

export interface Todo {
  text: string;
  done: boolean;
  deadline?: string | null;
  subtasks: SubTodo[];
  image?: string | null;
  createdAt?: string | null;
  priority?: "low" | "medium" | "high" | null;
  location?: LatLng | null;
}

export interface ListScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  language: "nl" | "en";
  toggleLanguage: () => void;
}
