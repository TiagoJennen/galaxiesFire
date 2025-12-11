import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TaskCreator, { TaskPriority } from "./TaskCreator";
import type { ThemeColors } from "../theme";
import type { TextInput } from "react-native";

export type TaskCreatorModalProps = {
  visible: boolean;
  colors: ThemeColors;
  theme: "light" | "dark";
  language: "nl" | "en";
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
  deadlinePreview: string;
  locationPreview: string;
  locationAccessibility: {
    label: string;
    hint: string;
  };
  onClose: () => void;
};

const TaskCreatorModal: React.FC<TaskCreatorModalProps> = ({
  visible,
  colors,
  theme,
  language,
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
  deadlinePreview,
  locationPreview,
  locationAccessibility,
  onClose,
}) => {
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const title = language === "nl" ? "Nieuwe hoofdtaak" : "New main task";
  const closeLabel = language === "nl" ? "Sluiten" : "Close";
  const closeHint =
    language === "nl"
      ? "Sluit het formulier zonder een taak op te slaan."
      : "Close the form without saving a task.";
  const submitLabel = language === "nl" ? "Toevoegen" : "Add";
  const submitHint =
    language === "nl"
      ? "Voeg de nieuwe hoofdtaak toe met de huidige instellingen."
      : "Add the new main task with the current settings.";
  const deadlineLabel = language === "nl" ? "Deadline" : "Deadline";
  const locationLabel = language === "nl" ? "Locatie" : "Location";
  const badgeEmpty = language === "nl" ? "Niet ingesteld" : "Not set";
  const deadlineValue = deadlinePreview || badgeEmpty;
  const locationValue = locationPreview || badgeEmpty;
  const deadlineEmpty = deadlinePreview.trim().length === 0;
  const locationEmpty = locationPreview.trim().length === 0;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          accessibilityHint={closeHint}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View style={styles.panelWrapper}>
          <View style={styles.panel}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                accessibilityHint={closeHint}
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={styles.closeIconColor.color as string}
                />
              </Pressable>
            </View>

            <View style={styles.summaryRow}>
              <SummaryBadge
                label={deadlineLabel}
                value={deadlineValue}
                isPlaceholder={deadlineEmpty}
                colors={colors}
                theme={theme}
              />
              <SummaryBadge
                label={locationLabel}
                value={locationValue}
                isPlaceholder={locationEmpty}
                colors={colors}
                theme={theme}
              />
            </View>

            <View style={styles.content}>
              <TaskCreator
                colors={colors}
                theme={theme}
                taskText={taskText}
                onChangeTask={onChangeTask}
                inputRef={inputRef}
                priority={priority}
                onSelectPriority={onSelectPriority}
                onOpenDate={onOpenDate}
                onOpenTime={onOpenTime}
                onOpenLocation={onOpenLocation}
                onAdd={onAdd}
                placeholder={placeholder}
                locationAccessibility={locationAccessibility}
                showInlineAdd={false}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={submitLabel}
                accessibilityHint={submitHint}
                onPress={onAdd}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                ]}
              >
                <Text style={styles.submitButtonLabel}>{submitLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default TaskCreatorModal;

const SummaryBadge: React.FC<{
  label: string;
  value: string;
  isPlaceholder: boolean;
  colors: ThemeColors;
  theme: "light" | "dark";
}> = ({ label, value, isPlaceholder, colors, theme }) => {
  const isLight = theme === "light";

  return (
    <View
      style={{
        flex: 1,
        marginRight: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: isLight ? "#EEF3FF" : "#1A2233",
        borderWidth: 1,
        borderColor: isLight ? "#D8E2F5" : "#252F43",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: colors.placeholder,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: isPlaceholder ? colors.placeholder : colors.text,
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors, theme: "light" | "dark") => {
  const isLight = theme === "light";
  const isWeb = Platform.OS === "web";

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    panelWrapper: {
      width: "100%",
      maxWidth: isWeb ? 680 : 540,
      alignSelf: "center",
    },
    panel: {
      borderRadius: 28,
      backgroundColor: colors.formBackground,
      padding: 20,
      shadowColor: "#000000",
      shadowOpacity: isLight ? 0.12 : 0.32,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 16,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.toggleButton,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.1 : 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    closeButtonPressed: {
      transform: [{ scale: 0.95 }],
      opacity: 0.85,
    },
    closeIconColor: {
      color: isLight ? "#2B303A" : "#E4E8F2",
    },
    summaryRow: {
      flexDirection: "row",
      marginBottom: 16,
    },
    content: {
      marginTop: 4,
      maxHeight: Platform.OS === "android" ? 620 : undefined,
    },
    submitButton: {
      marginTop: 16,
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 32,
      backgroundColor: colors.addButton,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      minWidth: isWeb ? 180 : 220,
      maxWidth: isWeb ? 320 : undefined,
      shadowColor: colors.addButton,
      shadowOpacity: isLight ? 0.28 : 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    submitButtonPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.97 }],
    },
    submitButtonLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
      letterSpacing: 0.3,
    },
  });
};
