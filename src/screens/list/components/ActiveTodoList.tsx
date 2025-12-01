import React from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InlineSubtaskEditor from "./InlineSubtaskEditor";
import type { ThemeColors } from "../theme";
import type { ListSource, SubTodo, Todo } from "../types";
import type { TranslationBundle } from "../../../constants/translations";
import type { DisplaySubtask, DisplayTodo } from "./types";

type ActiveTodoListProps = {
  colors: ThemeColors;
  language: "nl" | "en";
  strings: TranslationBundle;
  displayTodos: DisplayTodo[];
  buildSubtaskDisplay: (list: SubTodo[]) => DisplaySubtask[];
  formatDate: (value?: string | null) => string;
  getLocationDisplay: (
    location: Todo["location"],
    description?: string | null
  ) => string;
  priorityColor: (priority?: "low" | "medium" | "high" | null) => string;
  toggleTodo: (index: number, source?: ListSource) => void;
  openLocationPicker: (
    todoIndex?: number,
    source?: ListSource,
    subtaskIndex?: number | null
  ) => void;
  pickImage: (
    forSubtask?: boolean,
    todoIndex?: number,
    subIndex?: number,
    isArchive?: boolean,
    fromGallery?: boolean
  ) => void;
  openTodoEditor: (index: number, source?: ListSource) => void;
  archiveTodo: (index: number) => void;
  removeTodo: (index: number) => void;
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
  confirmDelete: (
    title: string,
    message: string,
    onConfirm: () => void
  ) => void;
  removeSubtask: (
    todoIndex: number,
    subIndex: number,
    source?: ListSource
  ) => void;
  addSubtask: (todoIndex: number, source?: ListSource) => void;
  beginInlineSubtaskCreation: (todoIndex: number, source: ListSource) => void;
  openInlineSubtaskLocation: (todoIndex: number, source: ListSource) => void;
  editingTodoIndex: number | null;
  editingTodoSource: ListSource;
  subtaskText: string;
  onChangeSubtaskText: (value: string) => void;
  newSubtaskPriority: "low" | "medium" | "high";
  onSelectSubtaskPriority: (value: "low" | "medium" | "high") => void;
  openSubtaskDate: () => void;
  openSubtaskTime: () => void;
};

const ActiveTodoList: React.FC<ActiveTodoListProps> = ({
  colors,
  language,
  strings,
  displayTodos,
  buildSubtaskDisplay,
  formatDate,
  getLocationDisplay,
  priorityColor,
  toggleTodo,
  openLocationPicker,
  pickImage,
  openTodoEditor,
  archiveTodo,
  removeTodo,
  toggleSubtask,
  openSubtaskEditor,
  confirmDelete,
  removeSubtask,
  addSubtask,
  beginInlineSubtaskCreation,
  openInlineSubtaskLocation,
  editingTodoIndex,
  editingTodoSource,
  subtaskText,
  onChangeSubtaskText,
  newSubtaskPriority,
  onSelectSubtaskPriority,
  openSubtaskDate,
  openSubtaskTime,
}) => {
  return (
    <FlatList
      data={displayTodos}
      keyExtractor={(entry) => entry.originalIndex.toString()}
      renderItem={({ item: displayEntry }) => {
        const item = displayEntry.item;
        const originalIndex = displayEntry.originalIndex;
        const deadlineDate = item.deadline ? new Date(item.deadline) : null;
        const today = new Date();
        const isSameDay =
          deadlineDate &&
          deadlineDate.getDate() === today.getDate() &&
          deadlineDate.getMonth() === today.getMonth() &&
          deadlineDate.getFullYear() === today.getFullYear();
        const deadlinePassed =
          deadlineDate && (deadlineDate < today || isSameDay);
        const addedLabel =
          (strings as any).added ??
          (language === "nl" ? "Toegevoegd" : "Added");

        return (
          <View
            style={{
              marginBottom: 15,
              backgroundColor: colors.formBackground,
              padding: 15,
              borderRadius: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => toggleTodo(originalIndex)}
                style={{ marginRight: 15 }}
              >
                <Ionicons
                  name={item.done ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={item.done ? "#28a745" : "#6c757d"}
                />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                {item.priority && (
                  <Text
                    style={{
                      fontSize: 12,
                      color:
                        item.priority === "high"
                          ? "#ff6b6b"
                          : item.priority === "medium"
                            ? "#ffb366"
                            : "#6bc66b",
                      fontWeight: "700",
                      marginBottom: 4,
                    }}
                  >
                    {item.priority.toUpperCase()}
                  </Text>
                )}
                <Text
                  style={{
                    fontSize: 16,
                    textDecorationLine: item.done ? "line-through" : "none",
                    color: item.done ? colors.doneText : colors.text,
                  }}
                >
                  {item.text}
                </Text>
                {item.createdAt && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6c757d",
                      marginTop: 4,
                    }}
                  >
                    {addedLabel}: {formatDate(item.createdAt)}
                  </Text>
                )}
                {item.deadline && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: deadlinePassed ? "red" : "#6c757d",
                      marginTop: 4,
                    }}
                  >
                    {strings.deadline}: {formatDate(item.deadline)}
                  </Text>
                )}
                {item.location && (
                  <TouchableOpacity
                    onPress={() => openLocationPicker(originalIndex)}
                    accessibilityRole="button"
                    accessibilityHint={
                      language === "nl"
                        ? "Wijzig de locatie van deze taak."
                        : "Edit this task's location."
                    }
                    style={{ alignSelf: "flex-start", marginTop: 4 }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#6c757d",
                        textDecorationLine: "underline",
                      }}
                    >
                      {strings.locationLabel}:{" "}
                      {getLocationDisplay(
                        item.location,
                        item.locationDescription ?? null
                      )}
                    </Text>
                  </TouchableOpacity>
                )}
                {item.image && (
                  <Image
                    source={{ uri: item.image }}
                    style={{
                      width: 100,
                      height: 100,
                      marginTop: 10,
                      borderRadius: 8,
                    }}
                  />
                )}
                <TouchableOpacity
                  onPress={() => pickImage(false, originalIndex)}
                >
                  <Text style={{ color: colors.addButton }}>
                    📷 {strings.addPhoto}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    pickImage(false, originalIndex, undefined, false, true)
                  }
                  style={{ marginTop: 5 }}
                >
                  <Text style={{ color: colors.addButton }}>
                    🖼️ {strings.pickFromGallery}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => openTodoEditor(originalIndex)}
                accessibilityLabel={
                  language === "nl" ? "Taak bewerken" : "Edit task"
                }
                accessibilityHint={
                  language === "nl"
                    ? "Pas titel, deadline, foto of locatie aan."
                    : "Update the task title, deadline, photo or location."
                }
                style={{ marginLeft: 10 }}
              >
                <Ionicons
                  name="create-outline"
                  size={24}
                  color={colors.addButton}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => archiveTodo(originalIndex)}
                style={{ marginLeft: 10 }}
              >
                <Ionicons
                  name="archive"
                  size={24}
                  color={colors.archiveButton}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeTodo(originalIndex)}
                style={{ marginLeft: 10 }}
              >
                <Ionicons name="trash" size={24} color={colors.deleteButton} />
              </TouchableOpacity>
            </View>

            {buildSubtaskDisplay(item.subtasks).map(
              ({ sub, originalIndex: subIndex }) => (
                <View
                  key={`todo-${originalIndex}-sub-${subIndex}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginLeft: 25,
                    marginBottom: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => toggleSubtask(originalIndex, subIndex)}
                    style={{ marginRight: 10 }}
                  >
                    <Ionicons
                      name={sub.done ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={sub.done ? "#28a745" : "#6c757d"}
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    {sub.priority && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: priorityColor(sub.priority),
                          fontWeight: "700",
                          marginBottom: 2,
                        }}
                      >
                        {sub.priority.toUpperCase()}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 16,
                        textDecorationLine: sub.done ? "line-through" : "none",
                      }}
                    >
                      {sub.text}
                    </Text>
                    {sub.createdAt && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#6c757d",
                          marginTop: 2,
                        }}
                      >
                        {addedLabel}: {formatDate(sub.createdAt)}
                      </Text>
                    )}
                    {sub.deadline && (
                      <Text
                        style={{
                          fontSize: 12,
                          color:
                            sub.deadline && new Date(sub.deadline) < new Date()
                              ? "red"
                              : "#6c757d",
                          marginTop: 2,
                        }}
                      >
                        {strings.deadline}: {formatDate(sub.deadline)}
                      </Text>
                    )}
                    {sub.location && (
                      <TouchableOpacity
                        onPress={() =>
                          openLocationPicker(originalIndex, "active", subIndex)
                        }
                        accessibilityRole="button"
                        accessibilityHint={
                          language === "nl"
                            ? "Wijzig de locatie van deze subtaak."
                            : "Edit this subtask's location."
                        }
                        style={{ alignSelf: "flex-start", marginTop: 2 }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#6c757d",
                            textDecorationLine: "underline",
                          }}
                        >
                          {strings.locationLabel}:{" "}
                          {getLocationDisplay(
                            sub.location,
                            sub.locationDescription ?? null
                          )}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {sub.image && (
                      <Image
                        source={{ uri: sub.image }}
                        style={{
                          width: 80,
                          height: 80,
                          marginTop: 5,
                          borderRadius: 8,
                        }}
                      />
                    )}
                    <View
                      style={{
                        flexDirection: "column",
                        marginTop: 5,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => pickImage(true, originalIndex, subIndex)}
                      >
                        <Text style={{ color: colors.addButton }}>
                          📷 {strings.addPhoto}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          pickImage(true, originalIndex, subIndex, false, true)
                        }
                        style={{ marginTop: 5 }}
                      >
                        <Text style={{ color: colors.addButton }}>
                          🖼️ {strings.pickFromGallery}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => openSubtaskEditor(originalIndex, subIndex)}
                    accessibilityLabel={
                      language === "nl" ? "Subtaak bewerken" : "Edit subtask"
                    }
                    accessibilityHint={
                      language === "nl"
                        ? "Pas de naam, deadline of foto van deze subtaak aan."
                        : "Update the name, deadline, or photo for this subtask."
                    }
                    style={{ marginLeft: 10 }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color={colors.addButton}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      confirmDelete(
                        strings.confirmDelete,
                        strings.deleteSubtask,
                        () => removeSubtask(originalIndex, subIndex, "active")
                      )
                    }
                    style={{ marginLeft: 10 }}
                  >
                    <Ionicons
                      name="trash"
                      size={20}
                      color={colors.deleteButton}
                    />
                  </TouchableOpacity>
                </View>
              )
            )}

            <TouchableOpacity
              onPress={() =>
                beginInlineSubtaskCreation(originalIndex, "active")
              }
              style={{ marginTop: 5 }}
            >
              <Text style={{ color: colors.addButton }}>
                + {strings.addSubtask}
              </Text>
            </TouchableOpacity>

            {editingTodoIndex === originalIndex &&
              editingTodoSource === "active" && (
                <InlineSubtaskEditor
                  text={subtaskText}
                  onChangeText={onChangeSubtaskText}
                  priority={newSubtaskPriority}
                  onSelectPriority={onSelectSubtaskPriority}
                  onOpenDate={openSubtaskDate}
                  onOpenTime={openSubtaskTime}
                  onOpenLocation={() =>
                    openInlineSubtaskLocation(originalIndex, "active")
                  }
                  onAdd={() => addSubtask(originalIndex)}
                  colors={colors}
                  placeholder={strings.newSubtask}
                  accessibilityLabels={{
                    locationLabel:
                      language === "nl"
                        ? "Locatie voor subtaak instellen"
                        : "Set subtask location",
                    locationHint:
                      language === "nl"
                        ? "Open de kaart om een locatie voor deze subtaak te kiezen."
                        : "Open the map to choose a location for this subtask.",
                  }}
                />
              )}
          </View>
        );
      }}
    />
  );
};

export default ActiveTodoList;
