import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { ThemeColors } from "../theme";

// Props voor de header controls
type ListHeaderControlsProps = {
  colors: ThemeColors;
  showArchive: boolean; // Of het archief-tabblad actief is
  language: "nl" | "en";
  theme: "light" | "dark";
  sortOrder: "oldest" | "newest"; // Sorteervolgorde op datum
  prioritySort: "highToLow" | "lowToHigh"; // Sorteervolgorde op prioriteit
  title: string; // Titel van de lijst
  tasksLabel: string; // Label voor taken-tab
  archiveLabel: string; // Label voor archief-tab
  onToggleLanguage: () => void; // Toggle taal
  onToggleTheme: () => void; // Toggle thema
  onToggleSortOrder: () => void; // Toggle datum sorteer volgorde
  onTogglePrioritySort: () => void; // Toggle prioriteit sorteer volgorde
  onSelectTab: (tab: "tasks" | "archive") => void; // Tab selecteren
};

const ListHeaderControls: React.FC<ListHeaderControlsProps> = ({
  colors,
  showArchive,
  language,
  theme,
  sortOrder,
  prioritySort,
  title,
  tasksLabel,
  archiveLabel,
  onToggleLanguage,
  onToggleTheme,
  onToggleSortOrder,
  onTogglePrioritySort,
  onSelectTab,
}) => (
  <>
    {/* Header titel + knoppen */}
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>
        {title}
      </Text>
      <View style={{ flexDirection: "row" }}>
        {/* Taal toggle */}
        <TouchableOpacity
          onPress={onToggleLanguage}
          style={{
            padding: 8,
            backgroundColor: colors.toggleButton,
            borderRadius: 8,
            marginRight: 5,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {language.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Thema toggle */}
        <TouchableOpacity
          onPress={onToggleTheme}
          style={{
            padding: 8,
            backgroundColor: colors.toggleButton,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </Text>
        </TouchableOpacity>

        {/* Datum sorteer toggle */}
        <TouchableOpacity
          onPress={onToggleSortOrder}
          style={{
            padding: 8,
            backgroundColor: colors.toggleButton,
            borderRadius: 8,
            marginLeft: 8,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {sortOrder === "oldest" ? "↓" : "↑"}
          </Text>
        </TouchableOpacity>

        {/* Prioriteit sorteer toggle */}
        <TouchableOpacity
          onPress={onTogglePrioritySort}
          style={{
            padding: 8,
            backgroundColor: colors.toggleButton,
            borderRadius: 8,
            marginLeft: 8,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {prioritySort === "highToLow" ? "P↓" : "P↑"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>

    {/* Tabbladen voor taken / archief */}
    <View style={{ flexDirection: "row", marginBottom: 20 }}>
      <TouchableOpacity
        onPress={() => onSelectTab("tasks")}
        style={{
          flex: 1,
          padding: 10,
          backgroundColor: !showArchive
            ? colors.addButton
            : colors.toggleButton,
          borderRadius: 8,
          marginRight: 5,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff" }}>{tasksLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onSelectTab("archive")}
        style={{
          flex: 1,
          padding: 10,
          backgroundColor: showArchive ? colors.addButton : colors.toggleButton,
          borderRadius: 8,
          marginLeft: 5,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff" }}>{archiveLabel}</Text>
      </TouchableOpacity>
    </View>
  </>
);

export default ListHeaderControls;
