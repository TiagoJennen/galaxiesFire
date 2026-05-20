// Inline formulier voor nieuwe hoofdtaak met prioriteit en shortcuts.
import React, { useMemo, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "../theme";
import InlineSubtaskEditor from "./InlineSubtaskEditor";

// Prioriteitstype voor een taak
export type TaskPriority = "low" | "medium" | "high";

// Props voor de TaskCreator component
type TaskCreatorProps = {
  colors: ThemeColors;
  theme: "light" | "dark";
  taskText: string;
  onChangeTask: (value: string) => void;
  inputRef?: React.RefObject<TextInput | null>;
  priority: TaskPriority;
  onSelectPriority: (value: TaskPriority) => void;
  onOpenDate: () => void;
  onOpenTime: () => void;
  onOpenLocation: () => void;
  onAdd: () => void;
  placeholder: string;
  descriptionPlaceholder: string;
  locationAccessibility: {
    label: string;
    hint: string;
  };
  showInlineAdd?: boolean;
};

// Knoppen voor prioriteit met bijbehorende kleuren
const PRIORITY_BUTTONS: Array<{
  label: string;
  value: TaskPriority;
  activeColor: string;
}> = [
  { label: "H", value: "high", activeColor: "#ff6b6b" },
  { label: "M", value: "medium", activeColor: "#ffb366" },
  { label: "L", value: "low", activeColor: "#6bc66b" },
];

const TaskCreator: React.FC<TaskCreatorProps> = ({
  colors,
  theme,
  taskText,
  onChangeTask,
  inputRef,
  priority,
  onSelectPriority,
  onOpenDate,
  onOpenTime,
  onOpenLocation,
  onAdd,
  placeholder,
  descriptionPlaceholder,
  locationAccessibility,
  showInlineAdd = true,
}) => {
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const addScale = useRef(new Animated.Value(1)).current;

  if (!showInlineAdd) {
    return (
      <InlineSubtaskEditor
        text={taskText}
        onChangeText={onChangeTask}
        priority={priority}
        onSelectPriority={onSelectPriority}
        onOpenDate={onOpenDate}
        onOpenTime={onOpenTime}
        onOpenLocation={onOpenLocation}
        onAdd={onAdd}
        colors={colors}
        theme={theme}
        placeholder={placeholder}
        accessibilityLabels={{
          locationLabel: locationAccessibility.label,
          locationHint: locationAccessibility.hint,
        }}
        showInlineAdd={false}
        variant="modal"
        inputRef={inputRef}
      />
    );
  }

  // Zorgt voor een subtiele verkleining wanneer de gebruiker de plusknop indrukt.
  const handleAddPressIn = () => {
    Animated.spring(addScale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 18,
      bounciness: 8,
    }).start();
  };

  // Reset de knop naar de originele schaal zodra het indrukken stopt.
  const handleAddPressOut = () => {
    Animated.spring(addScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 8,
    }).start();
  };

  // Herbruikbare icon-knop zodat datum, tijd en locatie dezelfde styling delen.
  const ActionIconButton: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    accessibilityLabel?: string;
    accessibilityHint?: string;
  }> = ({ icon, onPress, accessibilityLabel, accessibilityHint }) => (
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

  return (
    <View style={styles.card}>
      <TextInput
        placeholder={placeholder}
        value={taskText}
        onChangeText={onChangeTask}
        ref={inputRef ?? undefined}
        style={styles.input}
        placeholderTextColor={styles.placeholderColor.color as string}
        autoCorrect={false}
      />

      <TextInput
        placeholder={descriptionPlaceholder}
        value={taskDescription}
        onChangeText={onChangeDescription}
        style={[styles.input, styles.descriptionInput]}
        placeholderTextColor={styles.placeholderColor.color as string}
        autoCorrect={false}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.controlsRow}>
        <View style={styles.priorityRow}>
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

        <View style={styles.actionsCluster}>
          <ActionIconButton icon="calendar" onPress={onOpenDate} />
          <ActionIconButton icon="time" onPress={onOpenTime} />
          <ActionIconButton
            icon="location"
            onPress={onOpenLocation}
            accessibilityLabel={locationAccessibility.label}
            accessibilityHint={locationAccessibility.hint}
          />
        </View>

        {showInlineAdd ? (
          <Pressable
            onPress={onAdd}
            onPressIn={handleAddPressIn}
            onPressOut={handleAddPressOut}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            {/* Animatie op de plus zodat het toevoegen tastbaar aanvoelt. */}
            <Animated.View style={{ transform: [{ scale: addScale }] }}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

export default TaskCreator;

const createStyles = (colors: ThemeColors, theme: "light" | "dark") => {
  const accent = colors.addButton;
  const isLight = theme === "light";
  const isWeb = Platform.OS === "web";
  const titleFont = Platform.select({
    ios: "SFProText-Regular",
    android: "sans-serif",
    default: "System",
  });

  return StyleSheet.create({
    card: {
      marginBottom: 24,
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.formBackground,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
      width: "100%",
      maxWidth: isWeb ? 760 : undefined,
      alignSelf: isWeb ? "center" : "stretch",
    },
    input: {
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: Platform.OS === "ios" ? 16 : 14,
      backgroundColor: isLight ? "#F7F9FD" : "#1F2734",
      color: colors.text,
      fontSize: 16,
      fontFamily: titleFont,
      borderWidth: 1,
      borderColor: isLight ? "#E2E7F1" : "#252D3D",
    },
    placeholderColor: {
      color: colors.placeholder,
    },
    descriptionInput: {
      marginTop: 12,
      minHeight: 88,
    },
    controlsRow: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: isWeb ? "nowrap" : "wrap",
      rowGap: 12,
    },
    priorityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      flexGrow: 0,
      flexShrink: 0,
      marginBottom: 12,
      marginRight: 12,
    },
    priorityChip: {
      width: 32,
      height: 32,
      borderRadius: 8,
      marginRight: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isLight ? "#E1E6F0" : "#1F2734",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    priorityChipPressed: {
      transform: [{ scale: 0.96 }],
    },
    priorityLabel: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      color: isLight ? "#5C6474" : "#A7B0C2",
    },
    priorityLabelActive: {
      color: "#FFFFFF",
    },
    actionsCluster: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      marginLeft: "auto",
      marginRight: 12,
      marginBottom: 0,
    },
    actionIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
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
    iconTint: {
      color: accent,
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
      opacity: 0.9,
    },
  });
};
