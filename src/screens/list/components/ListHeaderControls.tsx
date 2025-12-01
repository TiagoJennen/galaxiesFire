import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { ThemeColors } from "../theme";

type ListHeaderControlsProps = {
  colors: ThemeColors;
  showArchive: boolean;
  language: "nl" | "en";
  theme: "light" | "dark";
  sortOrder: "oldest" | "newest";
  prioritySort: "highToLow" | "lowToHigh";
  title: string;
  tasksLabel: string;
  archiveLabel: string;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onToggleSortOrder: () => void;
  onTogglePrioritySort: () => void;
  onSelectTab: (tab: "tasks" | "archive") => void;
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
