import React from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InlineSubtaskEditor from "./InlineSubtaskEditor";
import type { ThemeColors } from "../theme";
import type { LatLng, ListSource, SubTodo, Todo } from "../types";
import type { TranslationBundle } from "../../../constants/translations";
import type { DisplaySubtask, DisplayTodo } from "./types";

const ARCHIVE_SOURCE: ListSource = "archive";

export type ArchivedTodoListProps = {
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

const ArchivedTodoList: React.FC<ArchivedTodoListProps> = ({
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
  openArchivedLocation,
  pickImage,
  openTodoEditor,
  unarchiveTodo,
  removeArchivedTodo,
  toggleSubtask,
  openSubtaskEditor,
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
  const addedLabel =
    (strings as any).added ?? (language === "nl" ? "Toegevoegd" : "Added");

  return (
    <FlatList
      data={displayTodos}
      keyExtractor={(entry) => `arch-${entry.originalIndex}`}
      renderItem={({ item: entry }) => {
        const item = entry.item;
        const originalIndex = entry.originalIndex;
        const deadlinePassed =
          item.deadline && new Date(item.deadline) < new Date();

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
                flexDirection: "column",
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => toggleTodo(originalIndex, ARCHIVE_SOURCE)}
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
                      onPress={() =>
                        openArchivedLocation(
                          item.location!,
                          item.locationDescription ?? null
                        )
                      }
                      accessibilityRole="button"
                      accessibilityHint={
                        language === "nl"
                          ? "Bekijk deze taaklocatie op de kaart."
                          : "View this task location on the map."
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

                  <View style={{ marginTop: 5 }}>
                    <TouchableOpacity
                      onPress={() =>
                        pickImage(false, originalIndex, undefined, true)
                      }
                    >
                      <Text style={{ color: colors.addButton }}>
                        📷 {strings.addPhoto}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        pickImage(false, originalIndex, undefined, true, true)
                      }
                      style={{ marginTop: 5 }}
                    >
                      <Text style={{ color: colors.addButton }}>
                        🖼️ {strings.pickFromGallery}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: "row" }}>
                  <TouchableOpacity
                    onPress={() =>
                      openTodoEditor(originalIndex, ARCHIVE_SOURCE)
                    }
                    accessibilityLabel={
                      language === "nl" ? "Taak bewerken" : "Edit task"
                    }
                    accessibilityHint={
                      language === "nl"
                        ? "Pas titel, deadline, foto of locatie van deze archief taak aan."
                        : "Update the archived task title, deadline, photo, or location."
                    }
                    style={{ marginRight: 10 }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={24}
                      color={colors.addButton}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => unarchiveTodo(originalIndex)}
                    style={{ marginRight: 10 }}
                  >
                    <Ionicons name="arrow-undo" size={24} color="#007bff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => removeArchivedTodo(originalIndex)}
                  >
                    <Ionicons
                      name="trash"
                      size={24}
                      color={colors.deleteButton}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {buildSubtaskDisplay(item.subtasks).map(
              ({ sub, originalIndex: subIndex }) => (
                <View
                  key={`arch-${originalIndex}-sub-${subIndex}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginLeft: 25,
                    marginBottom: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      toggleSubtask(originalIndex, subIndex, ARCHIVE_SOURCE)
                    }
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
                            new Date(sub.deadline) < new Date()
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
                        onPress={() =>
                          pickImage(true, originalIndex, subIndex, true)
                        }
                      >
                        <Text style={{ color: colors.addButton }}>
                          📷 {strings.addPhoto}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          pickImage(true, originalIndex, subIndex, true, true)
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
                    onPress={() =>
                      openSubtaskEditor(originalIndex, subIndex, ARCHIVE_SOURCE)
                    }
                    accessibilityLabel={
                      language === "nl" ? "Subtaak bewerken" : "Edit subtask"
                    }
                    accessibilityHint={
                      language === "nl"
                        ? "Pas de naam, deadline of foto van deze archief subtaak aan."
                        : "Update the archived subtask name, deadline, or photo."
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
                      removeSubtask(originalIndex, subIndex, ARCHIVE_SOURCE)
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
                beginInlineSubtaskCreation(originalIndex, ARCHIVE_SOURCE)
              }
              style={{ marginTop: 5 }}
            >
              <Text style={{ color: colors.addButton }}>
                + {strings.addSubtask}
              </Text>
            </TouchableOpacity>

            {editingTodoIndex === originalIndex &&
              editingTodoSource === ARCHIVE_SOURCE && (
                <InlineSubtaskEditor
                  text={subtaskText}
                  onChangeText={onChangeSubtaskText}
                  priority={newSubtaskPriority}
                  onSelectPriority={onSelectSubtaskPriority}
                  onOpenDate={openSubtaskDate}
                  onOpenTime={openSubtaskTime}
                  onOpenLocation={() =>
                    openInlineSubtaskLocation(originalIndex, ARCHIVE_SOURCE)
                  }
                  onAdd={() => addSubtask(originalIndex, ARCHIVE_SOURCE)}
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

export default ArchivedTodoList;
