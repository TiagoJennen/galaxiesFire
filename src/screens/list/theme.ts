// Het type voor de thema-modus van de app
export type ThemeMode = "light" | "dark";

// Kleuren die bij een thema horen
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

// Genereert de juiste kleuren afhankelijk van het gekozen thema
export const buildThemeColors = (mode: ThemeMode): ThemeColors => ({
  // Hoofdkleur van de achtergrond
  background: mode === "light" ? "#3A86FFFF" : "#222",

  // Achtergrond van invoervelden en formulieren
  formBackground: mode === "light" ? "#fff" : "#333",

  // Standaard tekstkleur
  text: mode === "light" ? "#000" : "#fff",

  // Kleur van placeholder-tekst in inputs
  placeholder: mode === "light" ? "#888" : "#aaa",

  // Kleur voor voltooide taken
  doneText: mode === "light" ? "#6c757d" : "#bbb",

  // Button-kleuren (vast, niet afhankelijk van thema)
  addButton: "#007bff",
  deleteButton: "#dc3545",
  archiveButton: "#ff8800",
  logoutButton: "#ff0000ff",
  toggleButton: "#6c757d",

  // Waarschuwing achtergrond en tekst (past mee met thema)
  warningBackground: mode === "light" ? "#fff4e5" : "#4a3a1a",
  warningText: mode === "light" ? "#a15c00" : "#ffcc80",
});
