// Modal voor hoofdtaakcreatie met samenvattende badges en iOS-picker overlays.
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
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import TaskCreator, { TaskPriority } from "./TaskCreator";
import SummaryBadge from "./SummaryBadge";
import type { ThemeColors } from "../theme";
import type { TextInput } from "react-native";

export type TaskCreatorModalProps = {
  visible: boolean;
  colors: ThemeColors;
  theme: "light" | "dark";
  language: "nl" | "en";
  taskText: string;
  onChangeTask: (value: string) => void;
  taskDescription: string;
  onChangeDescription: (value: string) => void;
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
  deadlinePreview: string;
  locationPreview: string;
  onClose: () => void;
  iosPicker?: null | {
    mode: "date" | "time";
    value: Date | null;
    onChange: (event: DateTimePickerEvent, date?: Date) => void;
    onConfirm: () => void;
    onCancel: () => void;
  };
};

const TaskCreatorModal: React.FC<TaskCreatorModalProps> = ({
  visible,
  colors,
  theme,
  language,
  taskText,
  onChangeTask,
  taskDescription,
  onChangeDescription,
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
  deadlinePreview,
  locationPreview,
  onClose,
  iosPicker = null,
}) => {
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const trimmedDeadline = deadlinePreview.trim();
  const trimmedLocation = locationPreview.trim();
  const badgeEmpty = language === "nl" ? "Niet ingesteld" : "Not set";
  const deadlineLabel = language === "nl" ? "Deadline" : "Deadline";
  const locationLabel = language === "nl" ? "Locatie" : "Location";
  const deadlineValue = trimmedDeadline.length ? trimmedDeadline : badgeEmpty;
  const locationValue = trimmedLocation.length ? trimmedLocation : badgeEmpty;
  const deadlineEmpty = trimmedDeadline.length === 0;
  const locationEmpty = trimmedLocation.length === 0;
  const title = language === "nl" ? "Nieuwe taak" : "New task";
  const closeLabel = language === "nl" ? "Sluiten" : "Close";
  const closeHint =
    language === "nl"
      ? "Sluit het formulier voor een nieuwe taak."
      : "Close the new task form.";
  const submitLabel = language === "nl" ? "Toevoegen" : "Add";
  const submitHint =
    language === "nl"
      ? "Voeg de nieuwe taak toe met de huidige instellingen."
      : "Add the new task with the current settings.";
  const shouldRenderPrimaryModal = visible;
  const showIOSPicker = Platform.OS === "ios" && iosPicker;
  const pickerDoneLabel = language === "nl" ? "Gereed" : "Done";

  if (!shouldRenderPrimaryModal) {
    return null;
  }

  return (
    <Modal
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      visible={shouldRenderPrimaryModal}
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
                taskDescription={taskDescription}
                onChangeDescription={onChangeDescription}
                inputRef={inputRef}
                priority={priority}
                onSelectPriority={onSelectPriority}
                onOpenDate={onOpenDate}
                onOpenTime={onOpenTime}
                onOpenLocation={onOpenLocation}
                onAdd={onAdd}
                placeholder={placeholder}
                descriptionPlaceholder={descriptionPlaceholder}
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

        {showIOSPicker ? (
          <View style={styles.pickerOverlay} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              onPress={iosPicker.onCancel}
              style={styles.pickerBackdrop}
            />
            <View style={styles.pickerSheetWrapper} pointerEvents="box-none">
              <View style={styles.pickerSheet} pointerEvents="auto">
                <DateTimePicker
                  value={iosPicker.value ?? new Date()}
                  mode={iosPicker.mode}
                  display="spinner"
                  onChange={iosPicker.onChange}
                  style={styles.picker}
                  textColor={colors.text}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={pickerDoneLabel}
                  onPress={iosPicker.onConfirm}
                  style={({ pressed }) => [
                    styles.pickerDoneButton,
                    pressed && styles.pickerDoneButtonPressed,
                  ]}
                >
                  <Text style={styles.pickerDoneLabel}>{pickerDoneLabel}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

export default TaskCreatorModal;

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
    pickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      zIndex: 20,
    },
    pickerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    pickerSheetWrapper: {
      padding: 16,
      width: "100%",
      alignItems: "center",
    },
    pickerSheet: {
      width: "100%",
      maxWidth: isWeb ? 540 : 520,
      borderRadius: 24,
      backgroundColor: colors.formBackground,
      paddingTop: 16,
      paddingHorizontal: 12,
      paddingBottom: 12,
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.2 : 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    picker: {
      width: "100%",
      height: 220,
    },
    pickerDoneButton: {
      marginTop: 12,
      alignSelf: "flex-end",
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 14,
      backgroundColor: colors.addButton,
      shadowColor: colors.addButton,
      shadowOpacity: isLight ? 0.2 : 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    pickerDoneButtonPressed: {
      opacity: 0.85,
    },
    pickerDoneLabel: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "600",
    },
  });
};
