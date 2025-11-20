export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  background: string;
  formBackground: string;
  text: string;
  placeholder: string;
  doneText: string;
  addButton: string;
  deleteButton: string;
  archiveButton: string;
  logoutButton: string;
  toggleButton: string;
  warningBackground: string;
  warningText: string;
};

export const buildThemeColors = (mode: ThemeMode): ThemeColors => ({
  background: mode === "light" ? "#3A86FFFF" : "#222",
  formBackground: mode === "light" ? "#fff" : "#333",
  text: mode === "light" ? "#000" : "#fff",
  placeholder: mode === "light" ? "#888" : "#aaa",
  doneText: mode === "light" ? "#6c757d" : "#bbb",
  addButton: "#007bff",
  deleteButton: "#dc3545",
  archiveButton: "#ff8800",
  logoutButton: "#ff0000ff",
  toggleButton: "#6c757d",
  warningBackground: mode === "light" ? "#fff4e5" : "#4a3a1a",
  warningText: mode === "light" ? "#a15c00" : "#ffcc80",
});
