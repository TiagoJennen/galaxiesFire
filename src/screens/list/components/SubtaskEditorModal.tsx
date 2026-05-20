// Bewerkmodal voor subtaken in dezelfde stijl als de hoofdtaak editor.
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import SummaryBadge from "./SummaryBadge";
import type { ThemeColors } from "../theme";
import type { SubTodo, LatLng } from "../types";

export type SubtaskStrings = {
  editSubtask: string;
  subtaskName: string;
  deadline: string;
  clearDeadline: string;
  noDeadline: string;
  deadlineOverdue: string;
  addPhoto: string;
  noPhoto: string;
  pickFromGallery: string;
  removePhoto: string;
  locationLabel: string;
  noLocationSelected: string;
  updateLocation: string;
  removeLocation: string;
  cancel: string;
  saveChanges: string;
};

export type SubtaskEditorModalProps = {
  visible: boolean;
  colors: ThemeColors;
  theme: "light" | "dark";
  subtaskText: string;
  onChangeText: (text: string) => void;
  onOpenDate: () => void;
  onOpenTime: () => void;
  onClearDeadline: () => void;
  deadlinePreview: string;
  deadlineISO?: string | null;
  showDatePicker: boolean;
  showTimePicker: boolean;
  dateValue: Date | null;
  timeValue: Date | null;
  onChangeDate: (event: DateTimePickerEvent, date?: Date) => void;
  onChangeTime: (event: DateTimePickerEvent, date?: Date) => void;
  onClose: () => void;
  onSave: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onRemoveImage: () => void;
  editingSubtask: SubTodo | null;
  onUpdateLocation: () => void;
  onRemoveLocation: () => void;
  location: LatLng | null;
  locationDescription?: string;
  strings: SubtaskStrings;
};

export default function SubtaskEditorModal({
  visible,
  colors,
  theme,
  subtaskText,
  onChangeText,
  onOpenDate,
  onOpenTime,
  onClearDeadline,
  deadlinePreview,
  deadlineISO,
  showDatePicker,
  showTimePicker,
  dateValue,
  timeValue,
  onChangeDate,
  onChangeTime,
  onClose,
  onSave,
  onPickCamera,
  onPickGallery,
  onRemoveImage,
  editingSubtask,
  onUpdateLocation,
  onRemoveLocation,
  location,
  locationDescription = "",
  strings,
}: SubtaskEditorModalProps) {
  const { width, height } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(colors, theme, { width, height }),
    [colors, theme, height, width],
  );

  if (!visible || !editingSubtask) {
    return null;
  }

  const trimmedDeadline = deadlinePreview?.trim() ?? "";
  const deadlineValue = trimmedDeadline.length
    ? trimmedDeadline
    : strings.noDeadline;
  const deadlineEmpty = trimmedDeadline.length === 0;
  const resolvedDeadlineISO = deadlineISO ?? editingSubtask.deadline ?? null;
  let isDeadlineOverdue = false;
  if (resolvedDeadlineISO && !editingSubtask.done) {
    const parsed = new Date(resolvedDeadlineISO).getTime();
    if (!Number.isNaN(parsed)) {
      isDeadlineOverdue = parsed < Date.now();
    }
  }
  const showDeadlineOverdue = !deadlineEmpty && isDeadlineOverdue;
  const deadlineSummaryValue = showDeadlineOverdue
    ? `${deadlineValue} - ${strings.deadlineOverdue}`
    : deadlineValue;
  const locationValue = locationDescription.trim().length
    ? locationDescription.trim()
    : strings.noLocationSelected;
  const locationEmpty = !(
    locationDescription && locationDescription.trim().length
  );
  const showNativeDatePicker = showDatePicker && Platform.OS !== "web";
  const showNativeTimePicker = showTimePicker && Platform.OS !== "web";

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
          accessibilityLabel={strings.cancel}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View style={styles.panelWrapper}>
          <View style={styles.panel}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{strings.editSubtask}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={strings.cancel}
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
                label={strings.deadline}
                value={deadlineSummaryValue}
                isPlaceholder={deadlineEmpty}
                colors={colors}
                theme={theme}
              />
              <SummaryBadge
                label={strings.locationLabel}
                value={locationValue}
                isPlaceholder={locationEmpty}
                colors={colors}
                theme={theme}
              />
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={Platform.OS !== "web"}
            >
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{strings.subtaskName}</Text>
                <TextInput
                  value={subtaskText}
                  onChangeText={onChangeText}
                  placeholder={strings.subtaskName}
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                />
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{strings.deadline}</Text>
                  {!deadlineEmpty ? (
                    <Pressable
                      onPress={onClearDeadline}
                      style={({ pressed }) => [
                        styles.subtleButton,
                        pressed && styles.subtleButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={colors.deleteButton}
                        style={styles.subtleButtonIcon}
                      />
                      <Text style={styles.subtleButtonLabel}>
                        {strings.clearDeadline}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={onOpenDate}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.iconButton,
                      pressed && styles.iconButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={styles.iconButtonIcon.color as string}
                    />
                  </Pressable>
                  <Pressable
                    onPress={onOpenTime}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.iconButton,
                      pressed && styles.iconButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={styles.iconButtonIcon.color as string}
                    />
                  </Pressable>
                </View>

                <Text style={styles.sectionBody} numberOfLines={2}>
                  {deadlineValue}
                </Text>

                {showDeadlineOverdue ? (
                  <View style={styles.overdueBadge}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={14}
                      color={colors.deleteButton}
                      style={styles.overdueBadgeIcon}
                    />
                    <Text style={styles.overdueBadgeLabel}>
                      {strings.deadlineOverdue}
                    </Text>
                  </View>
                ) : null}

                {showNativeDatePicker ? (
                  <DateTimePicker
                    value={dateValue ?? new Date()}
                    mode="date"
                    display="default"
                    onChange={onChangeDate}
                  />
                ) : null}

                {showNativeTimePicker ? (
                  <DateTimePicker
                    value={timeValue ?? new Date()}
                    mode="time"
                    display="default"
                    onChange={onChangeTime}
                  />
                ) : null}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{strings.addPhoto}</Text>

                {editingSubtask.image ? (
                  <Image
                    source={{ uri: editingSubtask.image }}
                    style={styles.photoPreview}
                  />
                ) : (
                  <Text style={styles.placeholderText}>{strings.noPhoto}</Text>
                )}

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={onPickCamera}
                    style={({ pressed }) => [
                      styles.pillButton,
                      pressed && styles.pillButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={16}
                      color={styles.iconButtonIcon.color as string}
                      style={styles.pillButtonIcon}
                    />
                    <Text style={styles.pillButtonLabel}>
                      {strings.addPhoto}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={onPickGallery}
                    style={({ pressed }) => [
                      styles.pillButton,
                      pressed && styles.pillButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={16}
                      color={styles.iconButtonIcon.color as string}
                      style={styles.pillButtonIcon}
                    />
                    <Text style={styles.pillButtonLabel}>
                      {strings.pickFromGallery}
                    </Text>
                  </Pressable>

                  {editingSubtask.image ? (
                    <Pressable
                      onPress={onRemoveImage}
                      style={({ pressed }) => [
                        styles.pillButton,
                        styles.destructiveButton,
                        pressed && styles.pillButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={colors.deleteButton}
                        style={styles.pillButtonIcon}
                      />
                      <Text style={styles.destructiveButtonLabel}>
                        {strings.removePhoto}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={[styles.sectionCard, styles.sectionCardLast]}>
                <Text style={styles.sectionTitle}>{strings.locationLabel}</Text>
                <Text
                  style={[
                    styles.sectionBody,
                    locationEmpty && styles.sectionBodyPlaceholder,
                  ]}
                  numberOfLines={2}
                >
                  {locationValue}
                </Text>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={onUpdateLocation}
                    style={({ pressed }) => [
                      styles.pillButton,
                      pressed && styles.pillButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={styles.iconButtonIcon.color as string}
                      style={styles.pillButtonIcon}
                    />
                    <Text style={styles.pillButtonLabel}>
                      {strings.updateLocation}
                    </Text>
                  </Pressable>

                  {location ? (
                    <Pressable
                      onPress={onRemoveLocation}
                      style={({ pressed }) => [
                        styles.pillButton,
                        styles.destructiveButton,
                        pressed && styles.pillButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={colors.deleteButton}
                        style={styles.pillButtonIcon}
                      />
                      <Text style={styles.destructiveButtonLabel}>
                        {strings.removeLocation}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            <View style={styles.footerRow}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.footerSecondaryButton,
                  styles.footerButtonSpacer,
                  pressed && styles.footerButtonPressed,
                ]}
              >
                <Text style={styles.footerSecondaryLabel}>
                  {strings.cancel}
                </Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.footerPrimaryButton,
                  pressed && styles.footerButtonPressed,
                ]}
              >
                <Text style={styles.footerPrimaryLabel}>
                  {strings.saveChanges}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (
  colors: ThemeColors,
  theme: "light" | "dark",
  layout: { width: number; height: number },
) => {
  const isLight = theme === "light";
  const accent = colors.addButton;
  const isWeb = Platform.OS === "web";
  const { width, height } = layout;

  const overlayPadding = isWeb ? 18 : 24;
  const panelPadding = isWeb ? 22 : 24;
  const maxPanelWidth = isWeb ? 520 : 560;
  const availableWidth = Math.max(width - overlayPadding * 2, 0);
  const panelWidth = Math.min(
    maxPanelWidth,
    availableWidth > 0 ? availableWidth : maxPanelWidth,
  );
  const heightCap = isWeb ? 560 : 600;
  const adaptiveLimit = Math.round(height * (isWeb ? 0.92 : 0.88));
  const availableHeight = Math.max(height - overlayPadding * 2, 0);
  const panelMaxHeight = Math.min(
    heightCap,
    adaptiveLimit > 0 ? adaptiveLimit : heightCap,
    availableHeight > 0 ? availableHeight : heightCap,
  );
  const reservedHeight = panelPadding * 2 + 140;
  const contentMaxHeight = Math.min(
    panelMaxHeight - panelPadding * 2,
    Math.max(panelMaxHeight - reservedHeight, 220),
  );

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: overlayPadding,
      paddingVertical: overlayPadding,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    panelWrapper: {
      width: panelWidth,
      maxWidth: maxPanelWidth,
      maxHeight: panelMaxHeight,
      alignSelf: "center",
      flexShrink: 1,
    },
    panel: {
      width: "100%",
      maxHeight: panelMaxHeight,
      borderRadius: 28,
      backgroundColor: colors.formBackground,
      padding: panelPadding,
      shadowColor: "#000000",
      shadowOpacity: isLight ? 0.12 : 0.32,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 16,
      flexShrink: 1,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
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
      flexWrap: "wrap",
      marginBottom: 18,
    },
    content: {
      marginTop: 4,
      maxHeight:
        Platform.OS === "android" ? 600 : isWeb ? 410 : contentMaxHeight,
      paddingRight: isWeb ? 6 : 0,
      flexGrow: 0,
      flexShrink: 1,
    },
    contentInner: {
      paddingBottom: 12,
    },
    sectionCard: {
      borderRadius: 20,
      padding: 18,
      backgroundColor: isLight ? "#F3F6FF" : "#141C28",
      borderWidth: 1,
      borderColor: isLight ? "#DCE5F6" : "#242F43",
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.08 : 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: isLight ? 8 : 12,
      marginBottom: 18,
    },
    sectionCardLast: {
      marginBottom: 0,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    input: {
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: Platform.OS === "ios" ? 14 : 12,
      backgroundColor: isLight ? "#FFFFFF" : "#1F2734",
      color: colors.text,
      borderWidth: 1,
      borderColor: isLight ? "#E2E7F1" : "#252D3D",
      fontSize: 15,
    },
    descriptionLabel: {
      marginTop: 16,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    descriptionInput: {
      marginTop: 10,
      minHeight: 96,
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 12,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: isLight ? "#E6ECF7" : "#1F2734",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 5 },
      elevation: 4,
      marginRight: 12,
      marginBottom: 10,
    },
    iconButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.94 }],
    },
    iconButtonIcon: {
      color: accent,
    },
    subtleButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: isLight ? "#FBE9E6" : "#2F1A1A",
    },
    subtleButtonPressed: {
      opacity: 0.85,
    },
    subtleButtonIcon: {
      marginRight: 6,
    },
    subtleButtonLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.deleteButton,
    },
    sectionBody: {
      fontSize: 14,
      color: colors.text,
    },
    sectionBodyPlaceholder: {
      color: colors.placeholder,
    },
    placeholderText: {
      fontSize: 14,
      color: colors.placeholder,
      marginBottom: 10,
    },
    overdueBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: isLight ? "#FBE9E6" : "#2F1A1A",
    },
    overdueBadgeIcon: {
      marginRight: 6,
    },
    overdueBadgeLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.deleteButton,
    },
    photoPreview: {
      width: "100%",
      height: 180,
      borderRadius: 18,
      marginBottom: 12,
    },
    pillButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: isLight ? "#E6ECF7" : "#1F2734",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      marginRight: 12,
      marginBottom: 10,
    },
    pillButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.97 }],
    },
    pillButtonIcon: {
      marginRight: 6,
    },
    pillButtonLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: accent,
    },
    destructiveButton: {
      backgroundColor: isLight ? "#FBE9E6" : "#2F1A1A",
      borderWidth: 1,
      borderColor: `${colors.deleteButton}55`,
    },
    destructiveButtonLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.deleteButton,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 24,
    },
    footerButton: {
      flex: 1,
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    footerButtonSpacer: {
      marginRight: 12,
    },
    footerButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.97 }],
    },
    footerSecondaryButton: {
      backgroundColor: colors.toggleButton,
    },
    footerPrimaryButton: {
      backgroundColor: accent,
    },
    footerSecondaryLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: isLight ? "#2B303A" : "#ECEFF6",
    },
    footerPrimaryLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
};
