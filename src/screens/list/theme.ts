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
  background: mode === "light" ? "#EFF3FA" : "#05090E",

  // Achtergrond van invoervelden en formulieren
  formBackground: mode === "light" ? "rgba(255,255,255,0.94)" : "#10141C",

  // Standaard tekstkleur
  text: mode === "light" ? "#0B0D11" : "#F5F7FA",

  // Kleur van placeholder-tekst in inputs
  placeholder: mode === "light" ? "#8B94A4" : "#7F8896",

  // Kleur voor voltooide taken
  doneText: mode === "light" ? "#A1A9B9" : "#6E7B8F",

  // Button-kleuren (vast, niet afhankelijk van thema)
  addButton: "#0A84FF",
  deleteButton: "#FF3B30",
  archiveButton: "#5E5CE6",
  logoutButton: "#FF2D55",
  toggleButton: mode === "light" ? "#E2E7F1" : "#1B2330",

  // Waarschuwing achtergrond en tekst (past mee met thema)
  warningBackground: mode === "light" ? "#FEF5E6" : "#3B2A14",
  warningText: mode === "light" ? "#B76A16" : "#FFCF8A",
});
