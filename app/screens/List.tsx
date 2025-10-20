import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FIREBASE_AUTH } from "../../FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { translations } from "../../translations";
import * as ImagePicker from "expo-image-picker";

interface SubTodo {
  text: string;
  done: boolean;
  deadline?: string | null;
  image?: string | null;
}

interface Todo {
  text: string;
  done: boolean;
  deadline?: string | null;
  subtasks: SubTodo[];
  image?: string | null;
}

interface Props {
  theme: "light" | "dark";
  toggleTheme: () => void;
  language: "nl" | "en";
  toggleLanguage: () => void;
}

const FIRESTORE_DB = getFirestore();

const List: React.FC<Props> = ({
  theme,
  toggleTheme,
  language,
  toggleLanguage,
}) => {
  const [task, setTask] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [archivedTodos, setArchivedTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [subtaskDate, setSubtaskDate] = useState<Date | null>(null);
  const [editingTodoIndex, setEditingTodoIndex] = useState<number | null>(null);
  const [showSubtaskDatePicker, setShowSubtaskDatePicker] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [subtaskTime, setSubtaskTime] = useState<Date | null>(null);
  const [showSubtaskTimePicker, setShowSubtaskTimePicker] = useState(false);

  const colors = {
    background: theme === "light" ? "#3A86FFFF" : "#222",
    formBackground: theme === "light" ? "#fff" : "#333",
    text: theme === "light" ? "#000" : "#fff",
    placeholder: theme === "light" ? "#888" : "#aaa",
    doneText: theme === "light" ? "#6c757d" : "#bbb",
    addButton: "#007bff",
    deleteButton: "#dc3545",
    archiveButton: "#ff8800",
    logoutButton: "#ff0000ff",
    toggleButton: "#6c757d",
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString(language === "nl" ? "nl-NL" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const saveTodosFirebase = async (
    userId: string,
    todosData: Todo[],
    archivedData: Todo[]
  ) => {
    try {
      const cleanTodos = todosData.map((todo) => ({
        ...todo,
        deadline: todo.deadline || null,
        image: todo.image || null,
        subtasks: todo.subtasks.map((sub) => ({
          ...sub,
          deadline: sub.deadline || null,
          image: sub.image || null,
        })),
      }));
      const cleanArchived = archivedData.map((todo) => ({
        ...todo,
        deadline: todo.deadline || null,
        image: todo.image || null,
        subtasks: todo.subtasks.map((sub) => ({
          ...sub,
          deadline: sub.deadline || null,
          image: sub.image || null,
        })),
      }));
      const userRef = doc(FIRESTORE_DB, "users", userId);
      await setDoc(userRef, { todos: cleanTodos, archive: cleanArchived });
    } catch (e) {
      console.log("Fout bij opslaan naar Firebase:", e);
    }
  };

  const loadTodosFirebase = async (userId: string) => {
    try {
      const userRef = doc(FIRESTORE_DB, "users", userId);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return { todos: data.todos || [], archive: data.archive || [] };
      }
      return { todos: [], archive: [] };
    } catch (e) {
      console.log("Fout bij laden vanuit Firebase:", e);
      return { todos: [], archive: [] };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(FIREBASE_AUTH, async (user) => {
      if (user) {
        setUserId(user.uid);
        const savedTodos = await AsyncStorage.getItem(`todos_${user.uid}`);
        if (savedTodos) setTodos(JSON.parse(savedTodos));
        const savedArchive = await AsyncStorage.getItem(`archive_${user.uid}`);
        if (savedArchive) setArchivedTodos(JSON.parse(savedArchive));
        const firebaseData = await loadTodosFirebase(user.uid);
        setTodos(firebaseData.todos);
        setArchivedTodos(firebaseData.archive);
      } else {
        setUserId(null);
        setTodos([]);
        setArchivedTodos([]);
      }
    });
    return unsubscribe;
  }, []);

  const saveAll = (newTodos: Todo[], newArchived: Todo[]) => {
    if (!userId) return;
    setTodos(newTodos);
    setArchivedTodos(newArchived);
    AsyncStorage.setItem(`todos_${userId}`, JSON.stringify(newTodos)).catch(
      (e) => console.log("Fout bij opslaan todos lokaal:", e)
    );
    AsyncStorage.setItem(
      `archive_${userId}`,
      JSON.stringify(newArchived)
    ).catch((e) => console.log("Fout bij opslaan archief lokaal:", e));
    saveTodosFirebase(userId, newTodos, newArchived);
  };

  const addTodo = () => {
    if (!task.trim()) return;

    let finalDate: string | null = null;
    if (selectedDate) {
      const date = new Date(selectedDate);
      if (selectedTime) {
        date.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      }
      finalDate = date.toISOString();
    }

    const newTodo: Todo = {
      text: task,
      done: false,
      deadline: finalDate,
      subtasks: [],
      image: null,
    };

    saveAll([...todos, newTodo], archivedTodos);
    setTask("");
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const toggleTodo = (index: number) => {
    const updated = [...todos];
    updated[index].done = !updated[index].done;
    saveAll(updated, archivedTodos);
  };

  const toggleSubtask = (todoIndex: number, subIndex: number) => {
    const updated = [...todos];
    updated[todoIndex].subtasks[subIndex].done =
      !updated[todoIndex].subtasks[subIndex].done;
    saveAll(updated, archivedTodos);
  };

  const removeTodo = (index: number) => {
    Alert.alert(
      translations[language].confirmDelete,
      translations[language].deleteTask,
      [
        { text: translations[language].cancel, style: "cancel" },
        {
          text: translations[language].delete,
          style: "destructive",
          onPress: () =>
            saveAll(
              todos.filter((_, i) => i !== index),
              archivedTodos
            ),
        },
      ]
    );
  };

  const archiveTodo = (index: number) => {
    const todoToArchive = todos[index];
    saveAll(
      todos.filter((_, i) => i !== index),
      [...archivedTodos, todoToArchive]
    );
  };

  const addSubtask = (todoIndex: number) => {
    if (!subtaskText.trim()) return;
    const updatedTodos = [...todos];
    updatedTodos[todoIndex].subtasks.push({
      text: subtaskText,
      done: false,
      deadline: subtaskDate?.toISOString() || null,
      image: null,
    });
    saveAll(updatedTodos, archivedTodos);
    setSubtaskText("");
    setSubtaskDate(null);
    setEditingTodoIndex(null);
  };

  const pickImage = async (
    forSubtask = false,
    todoIndex?: number,
    subIndex?: number,
    isArchive = false,
    fromGallery = false
  ) => {
    const permissionResult = fromGallery
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      alert(
        fromGallery
          ? "Toegang tot je galerij is nodig!"
          : "Camera toegang is nodig!"
      );
      return;
    }

    const result = fromGallery
      ? await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        })
      : await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      if (isArchive) {
        const updatedArchived = [...archivedTodos];
        if (forSubtask && todoIndex !== undefined && subIndex !== undefined) {
          updatedArchived[todoIndex].subtasks[subIndex].image = uri;
        } else if (!forSubtask && todoIndex !== undefined) {
          updatedArchived[todoIndex].image = uri;
        }
        saveAll(todos, updatedArchived);
      } else {
        const updatedTodos = [...todos];
        if (forSubtask && todoIndex !== undefined && subIndex !== undefined) {
          updatedTodos[todoIndex].subtasks[subIndex].image = uri;
        } else if (!forSubtask && todoIndex !== undefined) {
          updatedTodos[todoIndex].image = uri;
        }
        saveAll(updatedTodos, archivedTodos);
      }
    }
  };

  const logout = async () => {
    if (!userId) return;
    saveTodosFirebase(userId, todos, archivedTodos);
    FIREBASE_AUTH.signOut();
  };

  const toggleArchivedTodo = (index: number) => {
    const updatedArchived = [...archivedTodos];
    updatedArchived[index].done = !updatedArchived[index].done;
    saveAll(todos, updatedArchived);
  };

  const toggleArchivedSubtask = (todoIndex: number, subIndex: number) => {
    const updatedArchived = [...archivedTodos];
    updatedArchived[todoIndex].subtasks[subIndex].done =
      !updatedArchived[todoIndex].subtasks[subIndex].done;
    saveAll(todos, updatedArchived);
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text }}>
          {showArchive
            ? translations[language].archive
            : translations[language].tasks}
        </Text>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity
            onPress={toggleLanguage}
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
            onPress={toggleTheme}
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
        </View>
      </View>

      <View style={{ flexDirection: "row", marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => setShowArchive(false)}
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
          <Text style={{ color: "#fff" }}>{translations[language].tasks}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowArchive(true)}
          style={{
            flex: 1,
            padding: 10,
            backgroundColor: showArchive
              ? colors.addButton
              : colors.toggleButton,
            borderRadius: 8,
            marginLeft: 5,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff" }}>
            {translations[language].archive}
          </Text>
        </TouchableOpacity>
      </View>

      {!showArchive ? (
        <>
          <View
            style={{
              flexDirection: "row",
              marginBottom: 20,
              alignItems: "center",
            }}
          >
            <TextInput
              placeholder={translations[language].addTask}
              value={task}
              onChangeText={setTask}
              style={{
                flex: 1,
                padding: 10,
                backgroundColor: colors.formBackground,
                color: colors.text,
                borderRadius: 8,
              }}
              placeholderTextColor={colors.placeholder}
            />

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                marginLeft: 5,
                padding: 10,
                backgroundColor: "#6c757d",
                borderRadius: 8,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff" }}>📅</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={{
                marginLeft: 5,
                padding: 10,
                backgroundColor: "#6c757d",
                borderRadius: 8,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff" }}>⏰</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={addTodo}
              style={{
                marginLeft: 5,
                padding: 10,
                backgroundColor: colors.addButton,
                borderRadius: 8,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff" }}>+</Text>
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={selectedTime || new Date()}
                mode="time"
                display="default"
                onChange={(event: DateTimePickerEvent, time?: Date) => {
                  setShowTimePicker(false);
                  if (time) setSelectedTime(time);
                }}
              />
            )}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}

          <FlatList
            data={todos}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item, index }) => {
              const deadlineDate = item.deadline
                ? new Date(item.deadline)
                : null;
              const today = new Date();
              const isSameDay =
                deadlineDate &&
                deadlineDate.getDate() === today.getDate() &&
                deadlineDate.getMonth() === today.getMonth() &&
                deadlineDate.getFullYear() === today.getFullYear();

              const deadlinePassed =
                deadlineDate && (deadlineDate < today || isSameDay);

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
                      onPress={() => toggleTodo(index)}
                      style={{ marginRight: 15 }}
                    >
                      <Ionicons
                        name={
                          item.done ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={24}
                        color={item.done ? "#28a745" : "#6c757d"}
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          textDecorationLine: item.done
                            ? "line-through"
                            : "none",
                          color: item.done ? colors.doneText : colors.text,
                        }}
                      >
                        {item.text}
                      </Text>
                      {item.deadline && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: deadlinePassed ? "red" : "#6c757d",
                          }}
                        >
                          {translations[language].deadline}:{" "}
                          {formatDate(item.deadline)}
                        </Text>
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
                      <TouchableOpacity onPress={() => pickImage(false, index)}>
                        <Text style={{ color: colors.addButton }}>
                          📷 {translations[language].addPhoto}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          pickImage(false, index, undefined, false, true)
                        }
                        style={{ marginTop: 5 }}
                      >
                        <Text style={{ color: colors.addButton }}>
                          🖼️ {translations[language].pickFromGallery}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => archiveTodo(index)}
                      style={{ marginLeft: 10 }}
                    >
                      <Ionicons
                        name="archive"
                        size={24}
                        color={colors.archiveButton}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeTodo(index)}
                      style={{ marginLeft: 10 }}
                    >
                      <Ionicons
                        name="trash"
                        size={24}
                        color={colors.deleteButton}
                      />
                    </TouchableOpacity>
                  </View>

                  {item.subtasks.map((sub, subIndex) => {
                    const subDeadlineDate = sub.deadline
                      ? new Date(sub.deadline)
                      : null;
                    const isSubSameDay =
                      subDeadlineDate &&
                      subDeadlineDate.getDate() === today.getDate() &&
                      subDeadlineDate.getMonth() === today.getMonth() &&
                      subDeadlineDate.getFullYear() === today.getFullYear();

                    const subDeadlinePassed =
                      subDeadlineDate &&
                      (subDeadlineDate < today || isSubSameDay);

                    return (
                      <View
                        key={subIndex}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginLeft: 25,
                          marginBottom: 5,
                          flexWrap: "wrap",
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => toggleSubtask(index, subIndex)}
                          style={{ marginRight: 10 }}
                        >
                          <Ionicons
                            name={
                              sub.done ? "checkmark-circle" : "ellipse-outline"
                            }
                            size={20}
                            color={sub.done ? "#28a745" : "#6c757d"}
                          />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: sub.done
                                ? colors.doneText
                                : subDeadlinePassed
                                ? "red"
                                : colors.text,
                            }}
                          >
                            {sub.text}{" "}
                            {sub.deadline &&
                              `(${
                                translations[language].deadline
                              }: ${formatDate(sub.deadline)})`}
                          </Text>
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
                          <TouchableOpacity
                            onPress={() => pickImage(true, index, subIndex)}
                          >
                            <Text style={{ color: colors.addButton }}>
                              📷 {translations[language].addPhoto}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              pickImage(true, index, subIndex, true, true)
                            }
                            style={{ marginTop: 5 }}
                          >
                            <Text style={{ color: colors.addButton }}>
                              🖼️ {translations[language].pickFromGallery}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              translations[language].confirmDelete,
                              translations[language].deleteSubtask,
                              [
                                {
                                  text: translations[language].cancel,
                                  style: "cancel",
                                },
                                {
                                  text: translations[language].delete,
                                  style: "destructive",
                                  onPress: () => {
                                    const updatedTodos = [...todos];
                                    updatedTodos[index].subtasks = updatedTodos[
                                      index
                                    ].subtasks.filter((_, i) => i !== subIndex);
                                    saveAll(updatedTodos, archivedTodos);
                                  },
                                },
                              ]
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
                    );
                  })}

                  <TouchableOpacity
                    onPress={() => setEditingTodoIndex(index)}
                    style={{ marginTop: 5 }}
                  >
                    <Text style={{ color: colors.addButton }}>
                      + {translations[language].addSubtask}
                    </Text>
                  </TouchableOpacity>

                  {editingTodoIndex === index && (
                    <View
                      style={{
                        flexDirection: "row",
                        marginTop: 5,
                        marginLeft: 25,
                        alignItems: "center",
                      }}
                    >
                      <TextInput
                        placeholder={translations[language].newSubtask}
                        value={subtaskText}
                        onChangeText={setSubtaskText}
                        style={{
                          flex: 1,
                          padding: 8,
                          backgroundColor: colors.formBackground,
                          color: colors.text,
                          borderRadius: 8,
                        }}
                        placeholderTextColor={colors.placeholder}
                      />

                      <TouchableOpacity
                        onPress={() => setShowSubtaskDatePicker(true)}
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

                      <TouchableOpacity
                        onPress={() => setShowSubtaskTimePicker(true)}
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

                      <TouchableOpacity
                        onPress={() => addSubtask(index)}
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

                      {showSubtaskDatePicker && (
                        <DateTimePicker
                          value={subtaskDate || new Date()}
                          mode="date"
                          display="default"
                          onChange={(e: DateTimePickerEvent, date?: Date) => {
                            setShowSubtaskDatePicker(false);
                            if (date) setSubtaskDate(date);
                          }}
                        />
                      )}
                      {showSubtaskTimePicker && (
                        <DateTimePicker
                          value={subtaskTime || new Date()}
                          mode="time"
                          display="default"
                          is24Hour={true}
                          onChange={(e: DateTimePickerEvent, time?: Date) => {
                            setShowSubtaskTimePicker(false);
                            if (time) setSubtaskTime(time);
                          }}
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />
        </>
      ) : (
        <>
          <FlatList
            data={archivedTodos}
            keyExtractor={(_, index) => `arch-${index}`}
            renderItem={({ item, index }) => {
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
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => toggleArchivedTodo(index)}
                      style={{ marginRight: 15 }}
                    >
                      <Ionicons
                        name={
                          item.done ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={24}
                        color={item.done ? "#28a745" : "#6c757d"}
                      />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          textDecorationLine: item.done
                            ? "line-through"
                            : "none",
                          color: item.done ? colors.doneText : colors.text,
                        }}
                      >
                        {item.text}
                      </Text>
                      {item.deadline && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: deadlinePassed ? "red" : "#6c757d",
                          }}
                        >
                          {translations[language].deadline}:{" "}
                          {formatDate(item.deadline)}
                        </Text>
                      )}
                      {item.image && (
                        <Image
                          source={{ uri: item.image }}
                          style={{
                            width: 100,
                            height: 100,
                            marginTop: 5,
                            borderRadius: 8,
                          }}
                        />
                      )}
                      <TouchableOpacity
                        onPress={() => pickImage(false, index, undefined, true)}
                      >
                        <Text style={{ color: colors.addButton }}>
                          📷 {translations[language].addPhoto}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      <TouchableOpacity
                        onPress={() => {
                          const todoToUnarchive = archivedTodos[index];
                          saveAll(
                            [...todos, todoToUnarchive],
                            archivedTodos.filter((_, i) => i !== index)
                          );
                        }}
                        style={{ marginRight: 10 }}
                      >
                        <Ionicons name="arrow-undo" size={24} color="#007bff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            translations[language].confirmDelete,
                            translations[language].deleteTask,
                            [
                              {
                                text: translations[language].cancel,
                                style: "cancel",
                              },
                              {
                                text: translations[language].delete,
                                style: "destructive",
                                onPress: () =>
                                  saveAll(
                                    todos,
                                    archivedTodos.filter((_, i) => i !== index)
                                  ),
                              },
                            ]
                          )
                        }
                      >
                        <Ionicons
                          name="trash"
                          size={24}
                          color={colors.deleteButton}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {item.subtasks.map((sub, subIndex) => {
                    const subDeadlinePassed =
                      sub.deadline && new Date(sub.deadline) < new Date();
                    return (
                      <View
                        key={subIndex}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginLeft: 25,
                          marginBottom: 5,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => toggleArchivedSubtask(index, subIndex)}
                          style={{ marginRight: 10 }}
                        >
                          <Ionicons
                            name={
                              sub.done ? "checkmark-circle" : "ellipse-outline"
                            }
                            size={20}
                            color={sub.done ? "#28a745" : "#6c757d"}
                          />
                        </TouchableOpacity>
                        <Text
                          style={{
                            color: sub.done
                              ? colors.doneText
                              : subDeadlinePassed
                              ? "red"
                              : colors.text,
                          }}
                        >
                          {sub.text}{" "}
                          {sub.deadline &&
                            `(${translations[language].deadline}: ${formatDate(
                              sub.deadline
                            )})`}
                        </Text>
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
                        <TouchableOpacity
                          onPress={() => pickImage(true, index, subIndex, true)}
                        >
                          <Text style={{ color: colors.addButton }}>
                            📷 {translations[language].addPhoto}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            }}
          />
        </>
      )}

      <TouchableOpacity
        onPress={logout}
        style={{
          padding: 12,
          backgroundColor: colors.logoutButton,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          {translations[language].logout}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default List;
