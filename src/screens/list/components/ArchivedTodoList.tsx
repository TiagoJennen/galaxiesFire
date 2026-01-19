// Toont gearchiveerde taken met opties om terug te zetten of te verwijderen.
import React, { memo, useMemo } from "react";
import {
  Image,
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import type { FlashListRef } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "../theme";
import type { LatLng, ListSource, SubTodo, Todo } from "../types";
import type { TranslationBundle } from "../../../constants/translations";
import type { DisplaySubtask, DisplayTodo } from "./types";

const ARCHIVE_SOURCE: ListSource = "archive";

export interface ArchivedTodoListProps {
  colors: ThemeColors;
  theme: "light" | "dark";
  language: "nl" | "en";
  strings: TranslationBundle;
  displayTodos: DisplayTodo[];
  buildSubtaskDisplay: (list: SubTodo[]) => DisplaySubtask[];
  formatDate: (value?: string | null) => string;
  getLocationDisplay: (
    location: Todo["location"],
    description?: string | null
  ) => string;
  toggleTodo: (index: number, source?: ListSource) => void;
  openLocationPicker: (
    todoIndex?: number,
    source?: ListSource,
    subtaskIndex?: number | null
  ) => void;
  openArchivedLocation: (location: LatLng, description?: string | null) => void;
  pickImage: (
    forSubtask?: boolean,
    todoIndex?: number,
    subIndex?: number,
    isArchive?: boolean,
    fromGallery?: boolean
  ) => void;
  openTodoEditor: (index: number, source?: ListSource) => void;
  unarchiveTodo: (index: number) => void;
  removeArchivedTodo: (index: number) => void;
  toggleSubtask: (
    todoIndex: number,
    subIndex: number,
    source?: ListSource
  ) => void;
  openSubtaskEditor: (
    todoIndex: number,
    subIndex: number,
    source?: ListSource
  ) => void;
  removeSubtask: (
    todoIndex: number,
    subIndex: number,
    source?: ListSource
  ) => void;
  beginInlineSubtaskCreation: (todoIndex: number, source: ListSource) => void;
  listRef?: React.MutableRefObject<FlashListRef<DisplayTodo> | null>;
}

// Weergave voor gearchiveerde taken met dezelfde kaartstructuur als actief, maar andere acties.
const ArchivedTodoList: React.FC<ArchivedTodoListProps> = ({
  colors,
  theme,
  language,
  strings,
  displayTodos,
  buildSubtaskDisplay,
  formatDate,
  getLocationDisplay,
  toggleTodo,
  openLocationPicker,
  openArchivedLocation,
  pickImage,
  openTodoEditor,
  unarchiveTodo,
  removeArchivedTodo,
  toggleSubtask,
  openSubtaskEditor,
  removeSubtask,
  beginInlineSubtaskCreation,
  listRef,
}) => {
  // Herbereken stijlen enkel bij thema- of kleurwissel.
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const accent = colors.addButton;
  const addedLabel =
    (strings as any).added ?? (language === "nl" ? "Toegevoegd" : "Added");
  const isWeb = Platform.OS === "web";
  // Web krijgt extra margin/padding zodat scrollbars mooi uitkomen.
  const listStyle = isWeb ? [styles.list, styles.listWeb] : styles.list;
  const listContentStyle = isWeb
    ? [styles.listContent, styles.listContentWeb]
    : styles.listContent;

  // FlashList maakt het mogelijk om grote archieven toch vloeiend te scrollen.
  return (
    <FlashList
      ref={listRef ?? undefined}
      data={displayTodos}
      keyExtractor={(entry) => `arch-${entry.originalIndex}`}
      estimatedItemSize={340}
      style={listStyle}
      contentContainerStyle={listContentStyle}
      renderItem={({ item: entry }) => {
        const item = entry.item;
        const originalIndex = entry.originalIndex;
        // Gearchiveerde taken behouden hun deadline-informatie voor rapportage, daarom berekenen we hier opnieuw de status.
        const deadlineDate = item.deadline ? new Date(item.deadline) : null;
        const deadlineTime = deadlineDate ? deadlineDate.getTime() : null;
        const now = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
        const isDeadlineToday =
          deadlineTime !== null &&
          deadlineTime >= startOfToday.getTime() &&
          deadlineTime < startOfTomorrow.getTime();
        const isDeadlineOverdue = deadlineTime !== null && deadlineTime < now;
        const highlightDeadline = isDeadlineOverdue || isDeadlineToday;

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Pressable
                onPress={() => toggleTodo(originalIndex, ARCHIVE_SOURCE)}
                style={({ pressed }) => [
                  styles.checkButton,
                  item.done && styles.checkButtonDone,
                  pressed && styles.checkButtonPressed,
                ]}
              >
                <Ionicons
                  name={item.done ? "checkmark-circle" : "ellipse-outline"}
                  size={26}
                  color={
                    item.done ? accent : (styles.checkIcon.color as string)
                  }
                />
              </Pressable>

              <View style={styles.titleSection}>
                {item.priority ? (
                  <View
                    style={[
                      styles.priorityPill,
                      item.priority === "high"
                        ? styles.priorityHigh
                        : item.priority === "medium"
                          ? styles.priorityMedium
                          : styles.priorityLow,
                    ]}
                  >
                    <Text style={styles.priorityText}>
                      {item.priority.toUpperCase()}
                    </Text>
                  </View>
                ) : null}

                <Text
                  style={[styles.taskText, item.done && styles.taskTextDone]}
                  numberOfLines={3}
                >
                  {item.text}
                </Text>

                <View style={styles.metaRow}>
                  {item.createdAt ? (
                    <Text style={styles.metaText}>
                      {addedLabel}: {formatDate(item.createdAt)}
                    </Text>
                  ) : null}

                  {item.deadline ? (
                    <View style={styles.deadlineMeta}>
                      <Text
                        style={[
                          styles.metaText,
                          styles.deadlineMetaText,
                          highlightDeadline && styles.deadlineWarning,
                        ]}
                      >
                        {strings.deadline}: {formatDate(item.deadline)}
                      </Text>
                      {isDeadlineOverdue ? (
                        <View style={styles.deadlineBadge}>
                          <Ionicons
                            name="alert-circle"
                            size={12}
                            color={colors.deleteButton}
                            style={styles.deadlineBadgeIcon}
                          />
                          <Text style={styles.deadlineBadgeText}>
                            {strings.deadlineOverdue}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.iconCluster}>
                <Pressable
                  onPress={() => openTodoEditor(originalIndex, ARCHIVE_SOURCE)}
                  accessibilityLabel={
                    language === "nl" ? "Taak bewerken" : "Edit task"
                  }
                  accessibilityHint={
                    language === "nl"
                      ? "Pas titel, deadline, foto of locatie van deze taak aan."
                      : "Update the task title, deadline, photo or location."
                  }
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color={accent} />
                </Pressable>
                <Pressable
                  onPress={() => unarchiveTodo(originalIndex)}
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <Ionicons name="arrow-undo" size={18} color={accent} />
                </Pressable>
                <Pressable
                  onPress={() => removeArchivedTodo(originalIndex)}
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.deleteButton}
                  />
                </Pressable>
              </View>
            </View>

            {item.location ? (
              <Pressable
                onPress={() =>
                  openArchivedLocation(
                    item.location as LatLng,
                    item.locationDescription ?? null
                  )
                }
                accessibilityRole="button"
                accessibilityHint={
                  language === "nl"
                    ? "Bekijk deze taaklocatie op de kaart."
                    : "View this task location on the map."
                }
                style={({ pressed }) => [
                  styles.locationLink,
                  pressed && styles.locationLinkPressed,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={accent}
                  style={styles.locationIcon}
                />
                <Text style={styles.locationText} numberOfLines={2}>
                  {strings.locationLabel}:{" "}
                  {getLocationDisplay(
                    item.location,
                    item.locationDescription ?? null
                  )}
                </Text>
              </Pressable>
            ) : null}

            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.attachmentImage}
              />
            ) : null}

            <View style={styles.mediaRow}>
              <Pressable
                onPress={() => pickImage(false, originalIndex, undefined, true)}
                style={({ pressed }) => [
                  styles.mediaButton,
                  pressed && styles.mediaButtonPressed,
                ]}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={accent}
                  style={styles.mediaIcon}
                />
                <Text style={styles.mediaLabel}>{strings.addPhoto}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  pickImage(false, originalIndex, undefined, true, true)
                }
                style={({ pressed }) => [
                  styles.mediaButton,
                  pressed && styles.mediaButtonPressed,
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={16}
                  color={accent}
                  style={styles.mediaIcon}
                />
                <Text style={styles.mediaLabel}>{strings.pickFromGallery}</Text>
              </Pressable>
            </View>

            {/* Subtaken gebruiken dezelfde helper als actief zodat we geen code dupliceren. */}
            {buildSubtaskDisplay(item.subtasks).map(
              ({ sub, originalIndex: subIndex }) => {
                const subDeadlineDate = sub.deadline
                  ? new Date(sub.deadline)
                  : null;
                const subDeadlineTime = subDeadlineDate
                  ? subDeadlineDate.getTime()
                  : null;
                const subDeadlineOverdue =
                  subDeadlineTime !== null && subDeadlineTime < now;
                const highlightSubDeadline =
                  subDeadlineOverdue ||
                  (subDeadlineTime !== null &&
                    subDeadlineTime >= startOfToday.getTime() &&
                    subDeadlineTime < startOfTomorrow.getTime());

                return (
                  <View
                    key={`arch-${originalIndex}-sub-${subIndex}`}
                    style={styles.subtaskRow}
                  >
                    <Pressable
                      onPress={() =>
                        toggleSubtask(originalIndex, subIndex, ARCHIVE_SOURCE)
                      }
                      style={({ pressed }) => [
                        styles.subtaskCheck,
                        sub.done && styles.subtaskCheckDone,
                        pressed && styles.subtaskCheckPressed,
                      ]}
                    >
                      <Ionicons
                        name={sub.done ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={
                          sub.done ? accent : (styles.checkIcon.color as string)
                        }
                      />
                    </Pressable>

                    <View style={styles.subtaskContent}>
                      {sub.priority ? (
                        <View
                          style={[
                            styles.subtaskPriority,
                            sub.priority === "high"
                              ? styles.priorityHigh
                              : sub.priority === "medium"
                                ? styles.priorityMedium
                                : styles.priorityLow,
                          ]}
                        >
                          <Text style={styles.subtaskPriorityText}>
                            {sub.priority.toUpperCase()}
                          </Text>
                        </View>
                      ) : null}

                      <Text
                        style={[
                          styles.subtaskText,
                          sub.done && styles.subtaskTextDone,
                        ]}
                        numberOfLines={3}
                      >
                        {sub.text}
                      </Text>

                      <View style={styles.metaRow}>
                        {sub.createdAt ? (
                          <Text style={styles.metaText}>
                            {addedLabel}: {formatDate(sub.createdAt)}
                          </Text>
                        ) : null}

                        {sub.deadline ? (
                          <View style={styles.deadlineMeta}>
                            <Text
                              style={[
                                styles.metaText,
                                styles.deadlineMetaText,
                                highlightSubDeadline && styles.deadlineWarning,
                              ]}
                            >
                              {strings.deadline}: {formatDate(sub.deadline)}
                            </Text>
                            {subDeadlineOverdue ? (
                              <View style={styles.deadlineBadge}>
                                <Ionicons
                                  name="alert-circle"
                                  size={12}
                                  color={colors.deleteButton}
                                  style={styles.deadlineBadgeIcon}
                                />
                                <Text style={styles.deadlineBadgeText}>
                                  {strings.deadlineOverdue}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>

                      {sub.location ? (
                        <Pressable
                          onPress={() =>
                            openLocationPicker(
                              originalIndex,
                              ARCHIVE_SOURCE,
                              subIndex
                            )
                          }
                          accessibilityRole="button"
                          accessibilityHint={
                            language === "nl"
                              ? "Wijzig de locatie van deze archief subtaak."
                              : "Edit this archived subtask's location."
                          }
                          style={({ pressed }) => [
                            styles.locationLink,
                            pressed && styles.locationLinkPressed,
                          ]}
                        >
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color={accent}
                            style={styles.locationIcon}
                          />
                          <Text style={styles.locationText} numberOfLines={2}>
                            {strings.locationLabel}:{" "}
                            {getLocationDisplay(
                              sub.location,
                              sub.locationDescription ?? null
                            )}
                          </Text>
                        </Pressable>
                      ) : null}

                      {sub.image ? (
                        <Image
                          source={{ uri: sub.image }}
                          style={styles.subtaskImage}
                        />
                      ) : null}

                      <View style={styles.mediaRow}>
                        <Pressable
                          onPress={() =>
                            pickImage(true, originalIndex, subIndex, true)
                          }
                          style={({ pressed }) => [
                            styles.mediaButton,
                            pressed && styles.mediaButtonPressed,
                          ]}
                        >
                          <Ionicons
                            name="camera-outline"
                            size={16}
                            color={accent}
                            style={styles.mediaIcon}
                          />
                          <Text style={styles.mediaLabel}>
                            {strings.addPhoto}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            pickImage(true, originalIndex, subIndex, true, true)
                          }
                          style={({ pressed }) => [
                            styles.mediaButton,
                            pressed && styles.mediaButtonPressed,
                          ]}
                        >
                          <Ionicons
                            name="image-outline"
                            size={16}
                            color={accent}
                            style={styles.mediaIcon}
                          />
                          <Text style={styles.mediaLabel}>
                            {strings.pickFromGallery}
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.subtaskIconCluster}>
                      <Pressable
                        onPress={() =>
                          openSubtaskEditor(
                            originalIndex,
                            subIndex,
                            ARCHIVE_SOURCE
                          )
                        }
                        accessibilityLabel={
                          language === "nl"
                            ? "Subtaak bewerken"
                            : "Edit subtask"
                        }
                        accessibilityHint={
                          language === "nl"
                            ? "Pas de naam, deadline of foto van deze subtaak aan."
                            : "Update the name, deadline, or photo for this subtask."
                        }
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.iconButtonPressed,
                        ]}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={accent}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          removeSubtask(originalIndex, subIndex, ARCHIVE_SOURCE)
                        }
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.iconButtonPressed,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.deleteButton}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              }
            )}

            <Pressable
              onPress={() =>
                beginInlineSubtaskCreation(originalIndex, ARCHIVE_SOURCE)
              }
              style={({ pressed }) => [
                styles.addSubtaskButton,
                pressed && styles.addSubtaskButtonPressed,
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={accent}
                style={styles.mediaIcon}
              />
              <Text style={styles.addSubtaskText}>{strings.addSubtask}</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
};

export default memo(ArchivedTodoList);

const createStyles = (colors: ThemeColors, theme: "light" | "dark") => {
  const accent = colors.addButton;
  const isLight = theme === "light";
  const isWeb = Platform.OS === "web";
  const baseFont = Platform.select({
    ios: "SFProText-Regular",
    android: "sans-serif",
    default: "System",
  });
  const boldFont = Platform.select({
    ios: "SFProDisplay-Semibold",
    android: "sans-serif-medium",
    default: "System",
  });

  return StyleSheet.create({
    list: {
      width: "100%",
    },
    listWeb: {
      alignSelf: "center",
      maxWidth: 760,
    },
    listContent: {
      paddingBottom: 160,
      paddingHorizontal: 4,
    },
    listContentWeb: {
      paddingHorizontal: 0,
      alignItems: "stretch",
    },
    card: {
      marginBottom: 20,
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.formBackground,
      shadowColor: "#000000",
      shadowOpacity: isLight ? 0.08 : 0.32,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
      elevation: isLight ? 9 : 12,
      width: "100%",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    checkButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
      backgroundColor: isLight ? "#EAF0FB" : "#1F2734",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    checkButtonDone: {
      backgroundColor: `${accent}1A`,
    },
    checkButtonPressed: {
      transform: [{ scale: 0.94 }],
      opacity: 0.85,
    },
    checkIcon: {
      color: isLight ? "#8A94A8" : "#6C7688",
    },
    titleSection: {
      flex: 1,
    },
    priorityPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    priorityHigh: {
      backgroundColor: "#FF453A",
    },
    priorityMedium: {
      backgroundColor: "#FF9F0A",
    },
    priorityLow: {
      backgroundColor: "#34C759",
    },
    priorityText: {
      color: "#FFFFFF",
      fontFamily: boldFont,
      fontSize: 12,
      letterSpacing: 0.3,
    },
    taskText: {
      color: colors.text,
      fontFamily: boldFont,
      fontSize: 18,
      lineHeight: 24,
    },
    taskTextDone: {
      color: colors.doneText,
      textDecorationLine: "line-through",
    },
    metaRow: {
      marginTop: 10,
    },
    metaText: {
      color: isLight ? "#6F7787" : "#98A2B4",
      fontFamily: baseFont,
      fontSize: 12,
      marginBottom: 4,
    },
    deadlineMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
      marginBottom: 2,
    },
    deadlineMetaText: {
      marginRight: 0,
    },
    deadlineWarning: {
      color: "#FF3B30",
      fontWeight: "600",
    },
    deadlineBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: isLight ? "#FBE9E6" : "#2F1A1A",
      marginLeft: 8,
    },
    deadlineBadgeIcon: {
      marginRight: 4,
    },
    deadlineBadgeText: {
      color: colors.deleteButton,
      fontFamily: boldFont,
      fontSize: 11,
      letterSpacing: 0.2,
    },
    iconCluster: {
      flexDirection: "row",
      marginLeft: 12,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 14,
      backgroundColor: isLight ? "#EEF2FB" : "#1F2734",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 5 },
      elevation: 4,
    },
    iconButtonPressed: {
      transform: [{ scale: 0.92 }],
      opacity: 0.85,
    },
    locationLink: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: isLight ? "#F2F6FF" : "#1F2734",
    },
    locationLinkPressed: {
      opacity: 0.85,
    },
    locationIcon: {
      marginRight: 8,
    },
    locationText: {
      flex: 1,
      color: colors.text,
      fontFamily: baseFont,
      fontSize: 13,
    },
    attachmentImage: {
      width: "100%",
      height: 160,
      borderRadius: 20,
      marginTop: 16,
    },
    mediaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 14,
    },
    mediaButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      marginRight: 10,
      marginBottom: 8,
      backgroundColor: isLight ? "#E6ECF7" : "#1F2734",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    mediaButtonPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.85,
    },
    mediaIcon: {
      marginRight: 6,
    },
    mediaLabel: {
      color: accent,
      fontFamily: baseFont,
      fontSize: 13,
      fontWeight: "600",
    },
    subtaskRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 16,
    },
    subtaskCheck: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      backgroundColor: isLight ? "#EAF0FB" : "#1F2734",
    },
    subtaskCheckDone: {
      backgroundColor: `${accent}1A`,
    },
    subtaskCheckPressed: {
      transform: [{ scale: 0.95 }],
      opacity: 0.85,
    },
    subtaskContent: {
      flex: 1,
    },
    subtaskPriority: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginBottom: 6,
    },
    subtaskPriorityText: {
      color: "#FFFFFF",
      fontFamily: boldFont,
      fontSize: 11,
      letterSpacing: 0.3,
    },
    subtaskText: {
      color: colors.text,
      fontFamily: baseFont,
      fontSize: 16,
      lineHeight: 22,
    },
    subtaskTextDone: {
      color: colors.doneText,
      textDecorationLine: "line-through",
    },
    subtaskImage: {
      width: 120,
      height: 120,
      borderRadius: 18,
      marginTop: 12,
    },
    subtaskIconCluster: {
      flexDirection: "row",
      marginLeft: 12,
      marginTop: 4,
    },
    addSubtaskButton: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 18,
      alignSelf: "flex-start",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: isLight ? "#EAF2FF" : "#1F2734",
    },
    addSubtaskButtonPressed: {
      opacity: 0.85,
    },
    addSubtaskText: {
      color: accent,
      fontFamily: baseFont,
      fontSize: 14,
      fontWeight: "600",
      marginLeft: 4,
    },
  });
};
