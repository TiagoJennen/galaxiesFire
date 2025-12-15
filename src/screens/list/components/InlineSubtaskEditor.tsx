import React, { useMemo } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  theme: "light" | "dark";
  placeholder: string; // Placeholder tekst voor TextInput
  accessibilityLabels: {
    // Toegankelijkheidslabels
    locationLabel: string;
    locationHint: string;
  };
  showInlineAdd?: boolean;
  variant?: "inline" | "modal";
};

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
  theme,
  placeholder,
  accessibilityLabels,
  showInlineAdd = true,
  variant = "inline",
}) => {
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  // Variant bepaalt of de component inline op de lijst staat of in een modal werkt.
  const wrapperStyle =
    variant === "modal"
      ? [styles.wrapperBase, styles.wrapperModal]
      : [styles.wrapperBase, styles.wrapperInline];
  const controlsRowStyle =
    variant === "modal"
      ? [styles.controlsRow, styles.controlsRowModal]
      : [styles.controlsRow, styles.controlsRowInline];
  const priorityRowStyle =
    variant === "modal"
      ? [styles.priorityRow, styles.priorityRowModal]
      : [styles.priorityRow, styles.priorityRowInline];
  const actionsClusterStyle = [
    styles.actionsCluster,
    variant === "modal"
      ? styles.actionsClusterModal
      : styles.actionsClusterInline,
    !showInlineAdd && styles.actionsClusterNoAdd,
  ];

  return (
    <View style={wrapperStyle}>
      <TextInput
        placeholder={placeholder}
        value={text}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={styles.placeholderColor.color as string}
        autoCorrect={false}
      />

      <View style={controlsRowStyle}>
        <View style={priorityRowStyle}>
          {PRIORITY_BUTTONS.map((button) => {
            const isActive = priority === button.value;
            return (
              <Pressable
                key={button.value}
                onPress={() => onSelectPriority(button.value)}
                style={({ pressed }) => [
                  styles.priorityChip,
                  isActive && {
                    backgroundColor: button.activeColor,
                    shadowColor: button.activeColor,
                  },
                  pressed && styles.priorityChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.priorityLabel,
                    isActive && styles.priorityLabelActive,
                  ]}
                >
                  {button.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={actionsClusterStyle}>
          <IconButton icon="calendar" onPress={onOpenDate} styles={styles} />
          <IconButton icon="time" onPress={onOpenTime} styles={styles} />
          <IconButton
            icon="location"
            onPress={onOpenLocation}
            styles={styles}
            accessibilityLabel={accessibilityLabels.locationLabel}
            accessibilityHint={accessibilityLabels.locationHint}
          />
        </View>

        {showInlineAdd ? (
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

export default InlineSubtaskEditor;

type StyleShape = ReturnType<typeof createStyles>;

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  styles: StyleShape;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  styles,
  accessibilityLabel,
  accessibilityHint,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    style={({ pressed }) => [
      styles.actionIcon,
      pressed && styles.actionIconPressed,
    ]}
  >
    <Ionicons name={icon} size={16} color={styles.iconTint.color} />
  </Pressable>
);

const createStyles = (colors: ThemeColors, theme: "light" | "dark") => {
  const accent = colors.addButton;
  const isLight = theme === "light";
  const bodyFont = Platform.select({
    ios: "SFProText-Regular",
    android: "sans-serif",
    default: "System",
  });

  const isWeb = Platform.OS === "web";

  return StyleSheet.create({
    wrapperBase: {
      width: "100%",
    },
    wrapperInline: {
      marginTop: 18,
      padding: 16,
      borderRadius: 20,
      backgroundColor: isLight ? "#EEF3FF" : "#151E2B",
      borderWidth: 1,
      borderColor: isLight ? "#D8E2F5" : "#25324A",
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.08 : 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: isLight ? 8 : 12,
    },
    wrapperModal: {
      marginBottom: 24,
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.formBackground,
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.12 : 0.32,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: isLight ? 10 : 14,
    },
    input: {
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: Platform.OS === "ios" ? 14 : 12,
      backgroundColor: isLight ? "#F7F9FD" : "#1F2734",
      color: colors.text,
      fontFamily: bodyFont,
      fontSize: 15,
      borderWidth: 1,
      borderColor: isLight ? "#E2E7F1" : "#252D3D",
    },
    placeholderColor: {
      color: colors.placeholder,
    },
    controlsRow: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "flex-start",
      flexWrap: "wrap",
      rowGap: 12,
    },
    controlsRowInline: {
      alignItems: "flex-start",
    },
    controlsRowModal: {
      alignItems: "center",
      flexWrap: isWeb ? "nowrap" : "wrap",
    },
    priorityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      flexGrow: 0,
      flexShrink: 0,
      marginRight: 16,
      marginBottom: 12,
    },
    priorityRowInline: {
      marginBottom: 12,
    },
    priorityRowModal: {
      marginBottom: isWeb ? 0 : 12,
    },
    priorityChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: isLight ? "#E1E6F0" : "#1F2734",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    priorityChipPressed: {
      transform: [{ scale: 0.97 }],
    },
    priorityLabel: {
      fontFamily: bodyFont,
      fontWeight: "600",
      fontSize: 12,
      color: isLight ? "#5C6474" : "#A7B0C2",
    },
    priorityLabelActive: {
      color: "#FFFFFF",
    },
    actionsCluster: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      marginBottom: 12,
    },
    actionsClusterInline: {
      marginLeft: 0,
      marginRight: 0,
    },
    actionsClusterModal: {
      marginLeft: "auto",
      marginRight: 12,
    },
    actionsClusterNoAdd: {
      marginRight: 0,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isLight ? "#E6ECF7" : "#1F2734",
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 4,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    actionIconPressed: {
      transform: [{ scale: 0.94 }],
      opacity: 0.85,
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: accent,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
      marginLeft: 12,
      marginBottom: 12,
    },
    addButtonPressed: {
      opacity: 0.92,
    },
    iconTint: {
      color: accent,
    },
  });
};
