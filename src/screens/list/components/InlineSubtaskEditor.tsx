import React from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import type { ThemeColors } from "../theme";

// Mogelijke prioriteiten voor een subtask
export type SubtaskPriority = "low" | "medium" | "high";

// Props voor de inline subtask editor
type InlineSubtaskEditorProps = {
  text: string; // Tekst van de subtask
  onChangeText: (value: string) => void; // Callback bij tekstwijziging
  priority: SubtaskPriority; // Geselecteerde prioriteit
  onSelectPriority: (value: SubtaskPriority) => void; // Callback bij prioriteit wijziging
  onOpenDate: () => void; // Open datum picker
  onOpenTime: () => void; // Open tijd picker
  onOpenLocation: () => void; // Open locatie selector
  onAdd: () => void; // Callback bij toevoegen subtask
  colors: ThemeColors; // Kleuren van het thema
  placeholder: string; // Placeholder tekst voor TextInput
  accessibilityLabels: {
    // Toegankelijkheidslabels
    locationLabel: string;
    locationHint: string;
  };
};

// Knoppen voor prioriteit selecteren
const PRIORITY_BUTTONS: Array<{
  label: string;
  value: SubtaskPriority;
  activeColor: string;
}> = [
  { label: "H", value: "high", activeColor: "#ff6b6b" },
  { label: "M", value: "medium", activeColor: "#ffb366" },
  { label: "L", value: "low", activeColor: "#6bc66b" },
];

const InlineSubtaskEditor: React.FC<InlineSubtaskEditorProps> = ({
  text,
  onChangeText,
  priority,
  onSelectPriority,
  onOpenDate,
  onOpenTime,
  onOpenLocation,
  onAdd,
  colors,
  placeholder,
  accessibilityLabels,
}) => (
  <View
    style={{
      flexDirection: "row",
      marginTop: 5,
      marginLeft: 25,
      alignItems: "center",
    }}
  >
    {/* TextInput voor subtask */}
    <TextInput
      placeholder={placeholder}
      value={text}
      onChangeText={onChangeText}
      style={{
        flex: 1,
        padding: 8,
        backgroundColor: colors.formBackground,
        color: colors.text,
        borderRadius: 8,
      }}
      placeholderTextColor={colors.placeholder}
    />

    {/* Prioriteit knoppen */}
    <View style={{ flexDirection: "row", marginLeft: 5 }}>
      {PRIORITY_BUTTONS.map((button, index) => (
        <TouchableOpacity
          key={button.value}
          onPress={() => onSelectPriority(button.value)}
          style={{
            padding: 6,
            borderRadius: 8,
            backgroundColor:
              priority === button.value ? button.activeColor : "#444",
            marginRight: index < PRIORITY_BUTTONS.length - 1 ? 4 : 0,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {button.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    {/* Datum picker knop */}
    <TouchableOpacity
      onPress={onOpenDate}
      style={{
        marginLeft: 5,
        padding: 8,
        backgroundColor: "#6c757d",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>📅</Text>
    </TouchableOpacity>

    {/* Tijd picker knop */}
    <TouchableOpacity
      onPress={onOpenTime}
      style={{
        marginLeft: 5,
        padding: 8,
        backgroundColor: "#6c757d",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>⏰</Text>
    </TouchableOpacity>

    {/* Locatie knop */}
    <TouchableOpacity
      onPress={onOpenLocation}
      accessibilityLabel={accessibilityLabels.locationLabel}
      accessibilityHint={accessibilityLabels.locationHint}
      style={{
        marginLeft: 5,
        padding: 8,
        backgroundColor: "#6c757d",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>📍</Text>
    </TouchableOpacity>

    {/* Voeg subtask toe knop */}
    <TouchableOpacity
      onPress={onAdd}
      style={{
        marginLeft: 5,
        padding: 8,
        backgroundColor: colors.addButton,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>+</Text>
    </TouchableOpacity>
  </View>
);

export default InlineSubtaskEditor;
