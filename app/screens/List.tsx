import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FIREBASE_AUTH } from "../../FirebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { translations } from "../../translations";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { useNavigation, CommonActions } from "@react-navigation/native";
import MapLibreGL, { Logger } from "@maplibre/maplibre-react-native";
import { Region } from "react-native-maps";
import * as Location from "expo-location";
import {
  initializeGeofenceTask,
  syncGeofenceTargets,
  clearGeofenceTaskState,
} from "../background/geofenceTask";

const DEFAULT_REGION: Region = {
  latitude: 52.3702,
  longitude: 4.8952,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MAPLIBRE_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_CAMERA_ZOOM = 12;
const SELECTED_CAMERA_ZOOM = 14;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const regionToZoomLevel = (region?: Region | null) => {
  if (!region || !region.latitudeDelta) return null;
  const zoomApprox = Math.log2(360 / region.latitudeDelta);
  return clamp(zoomApprox, 3, 18);
};

const extractLonLatFromEvent = (
  event: any
): { latitude: number; longitude: number } | null => {
  const candidate =
    event?.geometry?.coordinates ??
    event?.nativeEvent?.geometry?.coordinates ??
    (Array.isArray(event?.features) &&
      event.features[0]?.geometry?.coordinates);
  if (!Array.isArray(candidate) || candidate.length < 2) return null;
  const [longitude, latitude] = candidate;
  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return null;
  }
  return { latitude, longitude };
};

/*
  Interfaces voor taken en subtaken.
  - SubTodo: tekst, status (done), optioneel deadline en afbeelding.
  - Todo: zelfde als SubTodo maar bevat een lijst met subtasks.
*/

interface SubTodo {
  text: string;
  done: boolean;
  deadline?: string | null;
  image?: string | null;
  createdAt?: string | null;
  priority?: "low" | "medium" | "high";
}

interface Todo {
  text: string;
  done: boolean;
  deadline?: string | null;
  subtasks: SubTodo[];
  image?: string | null;
  createdAt?: string | null;
  priority?: "low" | "medium" | "high";
  location?: LatLng | null;
}

type LatLng = { latitude: number; longitude: number };
type ListSource = "active" | "archive";

// Onthoud de laatst gekozen lijstweergave zodat toggles (zoals thema) het niet resetten.
let lastShowArchive = false;

/*
  Props die de List component verwacht:
  - theme: light | dark
  - toggleTheme: functie om thema te wisselen
  - language: 'nl' | 'en'
  - toggleLanguage: functie om taal te wisselen
*/

interface Props {
  theme: "light" | "dark";
  toggleTheme: () => void;
  language: "nl" | "en";
  toggleLanguage: () => void;
}

const FIRESTORE_DB = getFirestore();

// Hoofdfunctie van het scherm: toont takenlijst, formulieren en archive
const List: React.FC<Props> = ({
  theme,
  toggleTheme,
  language,
  toggleLanguage,
}) => {
  // Lokale state hooks voor UI en data
  // UseState om data op te slaan en te veranderen
  const [task, setTask] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [archivedTodos, setArchivedTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [subtaskDate, setSubtaskDate] = useState<Date | null>(null);
  const [editingTodoIndex, setEditingTodoIndex] = useState<number | null>(null);
  const [showSubtaskDatePicker, setShowSubtaskDatePicker] = useState(false);
  const [showArchive, setShowArchive] = useState(() => lastShowArchive);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [subtaskTime, setSubtaskTime] = useState<Date | null>(null);
  const [showSubtaskTimePicker, setShowSubtaskTimePicker] = useState(false);
  const navigation = useNavigation<any>();
  const [authReady, setAuthReady] = useState(false);
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<
    "low" | "medium" | "high"
  >("medium");
  // Sorteervolgorde: 'oldest' = eerst toegevoegd bovenaan, 'newest' = laatst toegevoegd bovenaan
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);
  const [locationHelperMessage, setLocationHelperMessage] = useState<
    string | null
  >(null);
  const dismissLocationHelperMessage = () => setLocationHelperMessage(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSearchText, setLocationSearchText] = useState("");
  const [editingLocationTodoIndex, setEditingLocationTodoIndex] = useState<
    number | null
  >(null);
  const toggleSortOrder = () =>
    setSortOrder((s) => (s === "oldest" ? "newest" : "oldest"));
  const [taskEditorVisible, setTaskEditorVisible] = useState(false);
  const [taskEditorIndex, setTaskEditorIndex] = useState<number | null>(null);
  const [taskEditorText, setTaskEditorText] = useState("");
  const [taskEditorDate, setTaskEditorDate] = useState<Date | null>(null);
  const [taskEditorTime, setTaskEditorTime] = useState<Date | null>(null);
  const [showTaskEditorDatePicker, setShowTaskEditorDatePicker] =
    useState(false);
  const [showTaskEditorTimePicker, setShowTaskEditorTimePicker] =
    useState(false);
  const [taskEditorSource, setTaskEditorSource] =
    useState<ListSource>("active");
  const [taskEditorSnapshot, setTaskEditorSnapshot] = useState<Todo | null>(
    null
  );
  const [subtaskEditorVisible, setSubtaskEditorVisible] = useState(false);
  const [subtaskEditorParentIndex, setSubtaskEditorParentIndex] = useState<
    number | null
  >(null);
  const [subtaskEditorIndex, setSubtaskEditorIndex] = useState<number | null>(
    null
  );
  const [subtaskEditorText, setSubtaskEditorText] = useState("");
  const [subtaskEditorDate, setSubtaskEditorDate] = useState<Date | null>(null);
  const [subtaskEditorTime, setSubtaskEditorTime] = useState<Date | null>(null);
  const [showSubtaskEditorDatePicker, setShowSubtaskEditorDatePicker] =
    useState(false);
  const [showSubtaskEditorTimePicker, setShowSubtaskEditorTimePicker] =
    useState(false);
  const [subtaskEditorSource, setSubtaskEditorSource] =
    useState<ListSource>("active");
  const [editingLocationSource, setEditingLocationSource] =
    useState<ListSource>("active");

  useEffect(() => {
    lastShowArchive = showArchive;
  }, [showArchive]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    try {
      MapLibreGL.setAccessToken?.("");
      MapLibreGL.setTelemetryEnabled?.(false);
    } catch (err) {
      console.log("MapLibre init error:", err);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const suppressMapLibreNoise = (log: {
      message: string;
      level: string;
      tag?: string;
    }) => {
      if (
        log.tag === "Mbgl-HttpRequest" &&
        log.message.startsWith(
          "Request failed due to a permanent error: Canceled"
        )
      ) {
        return true;
      }
      if (
        log.level === "warning" &&
        log.message.includes("Invalid geometry in line layer")
      ) {
        return true;
      }
      return false;
    };

    Logger.setLogCallback(suppressMapLibreNoise);
    return () => {
      Logger.setLogCallback(() => false);
    };
  }, []);

  // Prioriteits-sorteerrichting: highToLow of lowToHigh
  const [prioritySort, setPrioritySort] = useState<"highToLow" | "lowToHigh">(
    "highToLow"
  );
  const togglePrioritySort = () =>
    setPrioritySort((p) => (p === "highToLow" ? "lowToHigh" : "highToLow"));

  // Prioriteit voor nieuwe taak (default medium)
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">(
    "medium"
  );
  const priorityRank = (p?: string) =>
    p === "high" ? 2 : p === "medium" ? 1 : 0;
  const priorityColor = (p?: "low" | "medium" | "high") => {
    if (p === "high") return "#ff6b6b";
    if (p === "medium") return "#ffb366";
    if (p === "low") return "#6bc66b";
    return "#6c757d";
  };

  // Bouw gesorteerde display-list: eerst priority (high->low) daarna createdAt (afhankelijk van sortOrder).
  const buildDisplayList = (list: Todo[]) => {
    return list
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => {
        // sort by priority respecting prioritySort direction
        const aPr = priorityRank(a.item.priority);
        const bPr = priorityRank(b.item.priority);
        const pr = prioritySort === "highToLow" ? bPr - aPr : aPr - bPr;
        if (pr !== 0) return pr;
        // tie-breaker: createdAt depending on sortOrder
        const aTime = a.item.createdAt
          ? new Date(a.item.createdAt).getTime()
          : 0;
        const bTime = b.item.createdAt
          ? new Date(b.item.createdAt).getTime()
          : 0;
        if (sortOrder === "newest") return bTime - aTime;
        return aTime - bTime;
      });
  };

  const buildSubtaskDisplay = (list: SubTodo[]) => {
    return list
      .map((sub, originalIndex) => ({ sub, originalIndex }))
      .sort((a, b) => {
        const prA = priorityRank(a.sub.priority);
        const prB = priorityRank(b.sub.priority);
        const priorityDiff =
          prioritySort === "highToLow" ? prB - prA : prA - prB;
        if (priorityDiff !== 0) return priorityDiff;
        const timeA = a.sub.createdAt ? new Date(a.sub.createdAt).getTime() : 0;
        const timeB = b.sub.createdAt ? new Date(b.sub.createdAt).getTime() : 0;
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  };

  // Kleuren afhankelijk van thema
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
    warningBackground: theme === "light" ? "#fff4e5" : "#4a3a1a",
    warningText: theme === "light" ? "#a15c00" : "#ffcc80",
  };

  const geofenceTargetsFromTodos = (list: Todo[]) =>
    list
      .filter((todo) => todo.location)
      .map((todo) => ({
        id: `${todo.createdAt ?? todo.text}-${todo.location?.latitude ?? 0}-${
          todo.location?.longitude ?? 0
        }`,
        title: todo.text,
        latitude: todo.location!.latitude,
        longitude: todo.location!.longitude,
      }));

  // formatDate: zet ISO/string datum om naar leesbare tekst gebaseerd op taal
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

  // Sla taken op in Firestore (en normaliseer optionele velden naar null)
  const saveTodosFirebase = async (
    userId: string,
    todosData: Todo[],
    archivedData: Todo[]
  ) => {
    try {
      const cleanTodos = todosData.map((todo) => ({
        ...todo,
        deadline: todo.deadline || null,
        createdAt: todo.createdAt || null,
        priority: todo.priority || null,
        image: todo.image || null,
        location: todo.location || null,
        subtasks: todo.subtasks.map((sub) => ({
          ...sub,
          deadline: sub.deadline || null,
          createdAt: sub.createdAt || null,
          image: sub.image || null,
          priority: sub.priority || null,
        })),
      }));
      const cleanArchived = archivedData.map((todo) => ({
        ...todo,
        deadline: todo.deadline || null,
        createdAt: todo.createdAt || null,
        priority: todo.priority || null,
        image: todo.image || null,
        location: todo.location || null,
        subtasks: todo.subtasks.map((sub) => ({
          ...sub,
          deadline: sub.deadline || null,
          createdAt: sub.createdAt || null,
          image: sub.image || null,
          priority: sub.priority || null,
        })),
      }));
      const userRef = doc(FIRESTORE_DB, "users", userId);
      await setDoc(userRef, { todos: cleanTodos, archive: cleanArchived });
    } catch (e) {
      console.log("Fout bij opslaan naar Firebase:", e);
    }
  };

  // Laad taken uit Firestore; retourneer lege arrays bij fouten of geen document
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

  // Lifecycle: abonneer op auth state en laad data (lokale storage + firebase)
  // UseEffect om iets te doen als er iets verandert
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(FIREBASE_AUTH, async (user) => {
      if (user) {
        setUserId(user.uid);
        await AsyncStorage.setItem("current_user_id", user.uid);
        const savedTodos = await AsyncStorage.getItem(`todos_${user.uid}`);
        if (savedTodos) setTodos(JSON.parse(savedTodos));
        const savedArchive = await AsyncStorage.getItem(`archive_${user.uid}`);
        if (savedArchive) setArchivedTodos(JSON.parse(savedArchive));
        const firebaseData = await loadTodosFirebase(user.uid);
        setTodos(firebaseData.todos);
        setArchivedTodos(firebaseData.archive);
      } else {
        await AsyncStorage.removeItem("current_user_id");
        await clearGeofenceTaskState();
        setUserId(null);
        setTodos([]);
        setArchivedTodos([]);
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Algemene save functie: update state + persist (locaal en firebase)
  const saveAll = (newTodos: Todo[], newArchived: Todo[]) => {
    setTodos(newTodos);
    setArchivedTodos(newArchived);

    if (userId) {
      // Sla lokaal op per gebruiker en push naar firestore
      AsyncStorage.setItem(`todos_${userId}`, JSON.stringify(newTodos)).catch(
        (e) => console.log("Fout bij opslaan todos lokaal:", e)
      );
      AsyncStorage.setItem(
        `archive_${userId}`,
        JSON.stringify(newArchived)
      ).catch((e) => console.log("Fout bij opslaan archief lokaal:", e));
      saveTodosFirebase(userId, newTodos, newArchived);
    } else {
      // Sla lokaal op voor anonieme gebruiker
      AsyncStorage.setItem("todos_local", JSON.stringify(newTodos)).catch((e) =>
        console.log("Fout bij opslaan todos lokaal (local):", e)
      );
      AsyncStorage.setItem("archive_local", JSON.stringify(newArchived)).catch(
        (e) => console.log("Fout bij opslaan archief lokaal (local):", e)
      );
    }
    if (Platform.OS !== "web" && userId && locationPermissionGranted) {
      syncGeofenceTargets(userId, geofenceTargetsFromTodos(newTodos)).catch(
        (err) => console.log("Geofence sync failed:", err)
      );
    }
  };

  // Toon bevestigingsdialoog voordat iets verwijderd wordt
  const confirmDelete = (
    title: string,
    message: string,
    onConfirm: () => void
  ) => {
    if (Platform.OS === "web") {
      if (window.confirm(message)) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: translations[language].cancel, style: "cancel" },
      {
        text: translations[language].delete,
        style: "destructive",
        onPress: onConfirm,
      },
    ]);
  };

  const showInputWarning = (message: string) => {
    const title = language === "nl" ? "Let op" : "Warning";
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      const okLabel = "OK";
      Alert.alert(title, message, [{ text: okLabel }]);
    }
  };

  // Combineer datum + tijd naar ISO string (gebruik 00:00 als geen tijd)
  const combineDateAndTime = (date: Date | null, time: Date | null) => {
    if (!date && !time) return null;
    const d = date ? new Date(date) : new Date();
    if (time) {
      d.setHours(time.getHours(), time.getMinutes(), 0, 0);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    return d.toISOString();
  };

  // Voeg een nieuwe taak toe met optionele deadline/tijd
  const addTodo = () => {
    if (!task.trim()) {
      showInputWarning(
        language === "nl" ? "Vul een taak in." : "Please enter a task."
      );
      return;
    }

    const finalDate = combineDateAndTime(selectedDate, selectedTime);

    const newTodo: Todo = {
      text: task,
      done: false,
      deadline: finalDate,
      subtasks: [],
      image: null,
      createdAt: new Date().toISOString(),
      priority: newPriority,
      location: selectedLocation,
    };
    saveAll([...todos, newTodo], archivedTodos);
    setTask("");
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedLocation(null);
    setMapRegion(null);
  };

  const openTodoEditor = (index: number, source: ListSource = "active") => {
    const list = source === "archive" ? archivedTodos : todos;
    const target = list[index];
    if (!target) return;
    setTaskEditorSource(source);
    setTaskEditorIndex(index);
    setTaskEditorText(target.text);
    if (target.deadline) {
      const deadlineDate = new Date(target.deadline);
      setTaskEditorDate(deadlineDate);
      setTaskEditorTime(deadlineDate);
    } else {
      setTaskEditorDate(null);
      setTaskEditorTime(null);
    }
    setShowTaskEditorDatePicker(false);
    setShowTaskEditorTimePicker(false);
    setTaskEditorSnapshot({
      ...target,
      subtasks: [...target.subtasks],
    });
    setTaskEditorVisible(true);
  };

  const closeTodoEditor = () => {
    setTaskEditorVisible(false);
    setTaskEditorIndex(null);
    setTaskEditorText("");
    setTaskEditorDate(null);
    setTaskEditorTime(null);
    setShowTaskEditorDatePicker(false);
    setShowTaskEditorTimePicker(false);
    setTaskEditorSource("active");
    setTaskEditorSnapshot(null);
  };

  const saveTodoEditor = () => {
    if (taskEditorIndex === null) return;
    const trimmed = taskEditorText.trim();
    if (!trimmed) {
      showInputWarning(translations[language].taskNameRequired);
      return;
    }

    const isArchive = taskEditorSource === "archive";
    const updatedTodos = [...todos];
    const updatedArchived = [...archivedTodos];
    const targetList = isArchive ? updatedArchived : updatedTodos;
    const target = targetList[taskEditorIndex];
    if (!target) {
      closeTodoEditor();
      return;
    }
    targetList[taskEditorIndex] = {
      ...target,
      text: trimmed,
      deadline: combineDateAndTime(taskEditorDate, taskEditorTime),
    };
    saveAll(updatedTodos, updatedArchived);
    closeTodoEditor();
  };

  const openTaskEditorDate = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        language === "nl"
          ? "Voer datum in (YYYY-MM-DD of DD-MM-YYYY):"
          : "Enter a date (YYYY-MM-DD or DD-MM-YYYY):",
        taskEditorDate ? taskEditorDate.toISOString().slice(0, 10) : ""
      );
      const parsed = parseDateInput(input);
      if (parsed) setTaskEditorDate(parsed);
      return;
    }
    setShowTaskEditorDatePicker(true);
  };

  const openTaskEditorTime = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        language === "nl"
          ? "Voer tijd in (HH:MM, 24u):"
          : "Enter a time (HH:MM, 24h):",
        taskEditorTime
          ? `${String(taskEditorTime.getHours()).padStart(2, "0")}:${String(
              taskEditorTime.getMinutes()
            ).padStart(2, "0")}`
          : ""
      );
      const parsed = parseTimeInput(input);
      if (parsed) setTaskEditorTime(parsed);
      return;
    }
    setShowTaskEditorTimePicker(true);
  };

  const clearTaskEditorDeadline = () => {
    setTaskEditorDate(null);
    setTaskEditorTime(null);
  };

  const handleTaskEditorDateChange = (
    event: DateTimePickerEvent,
    date?: Date
  ) => {
    setShowTaskEditorDatePicker(false);
    if (event.type === "dismissed") return;
    if (date) setTaskEditorDate(date);
  };

  const handleTaskEditorTimeChange = (
    event: DateTimePickerEvent,
    time?: Date
  ) => {
    setShowTaskEditorTimePicker(false);
    if (event.type === "dismissed") return;
    if (time) setTaskEditorTime(time);
  };

  const clearTodoImage = (index: number, source: ListSource = "active") => {
    const updatedTodos = [...todos];
    const updatedArchived = [...archivedTodos];
    if (source === "archive") {
      if (!updatedArchived[index]) return;
      updatedArchived[index] = { ...updatedArchived[index], image: null };
    } else {
      if (!updatedTodos[index]) return;
      updatedTodos[index] = { ...updatedTodos[index], image: null };
    }
    saveAll(updatedTodos, updatedArchived);
    if (taskEditorIndex === index && taskEditorSource === source) {
      setTaskEditorSnapshot((prev) => (prev ? { ...prev, image: null } : prev));
    }
  };

  const clearTodoLocation = (index: number, source: ListSource = "active") => {
    const updatedTodos = [...todos];
    const updatedArchived = [...archivedTodos];
    if (source === "archive") {
      if (!updatedArchived[index]) return;
      updatedArchived[index] = { ...updatedArchived[index], location: null };
    } else {
      if (!updatedTodos[index]) return;
      updatedTodos[index] = { ...updatedTodos[index], location: null };
    }
    saveAll(updatedTodos, updatedArchived);
    if (taskEditorIndex === index && taskEditorSource === source) {
      setTaskEditorSnapshot((prev) =>
        prev ? { ...prev, location: null } : prev
      );
    }
  };

  const openSubtaskEditor = (
    todoIndex: number,
    subIndex: number,
    source: ListSource = "active"
  ) => {
    const parentList = source === "archive" ? archivedTodos : todos;
    const parent = parentList[todoIndex];
    const sub = parent?.subtasks[subIndex];
    if (!parent || !sub) return;
    setSubtaskEditorSource(source);
    setSubtaskEditorParentIndex(todoIndex);
    setSubtaskEditorIndex(subIndex);
    setSubtaskEditorText(sub.text);
    if (sub.deadline) {
      const deadlineDate = new Date(sub.deadline);
      setSubtaskEditorDate(deadlineDate);
      setSubtaskEditorTime(deadlineDate);
    } else {
      setSubtaskEditorDate(null);
      setSubtaskEditorTime(null);
    }
    setShowSubtaskEditorDatePicker(false);
    setShowSubtaskEditorTimePicker(false);
    setSubtaskEditorVisible(true);
  };

  const closeSubtaskEditor = () => {
    setSubtaskEditorVisible(false);
    setSubtaskEditorParentIndex(null);
    setSubtaskEditorIndex(null);
    setSubtaskEditorText("");
    setSubtaskEditorDate(null);
    setSubtaskEditorTime(null);
    setShowSubtaskEditorDatePicker(false);
    setShowSubtaskEditorTimePicker(false);
    setSubtaskEditorSource("active");
  };

  const saveSubtaskEditor = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null)
      return;
    const trimmed = subtaskEditorText.trim();
    if (!trimmed) {
      showInputWarning(translations[language].subtaskNameRequired);
      return;
    }
    const isArchive = subtaskEditorSource === "archive";
    const updatedTodos = [...todos];
    const updatedArchived = [...archivedTodos];
    const parentList = isArchive ? updatedArchived : updatedTodos;
    const parent = parentList[subtaskEditorParentIndex];
    if (!parent) {
      closeSubtaskEditor();
      return;
    }
    const existingSub = parent.subtasks[subtaskEditorIndex];
    if (!existingSub) {
      closeSubtaskEditor();
      return;
    }
    const updatedSubtasks = [...parent.subtasks];
    updatedSubtasks[subtaskEditorIndex] = {
      ...existingSub,
      text: trimmed,
      deadline: combineDateAndTime(subtaskEditorDate, subtaskEditorTime),
    };
    parentList[subtaskEditorParentIndex] = {
      ...parent,
      subtasks: updatedSubtasks,
    };
    saveAll(updatedTodos, updatedArchived);
    closeSubtaskEditor();
  };

  const openSubtaskEditorDate = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        language === "nl"
          ? "Voer datum in (YYYY-MM-DD of DD-MM-YYYY):"
          : "Enter a date (YYYY-MM-DD or DD-MM-YYYY):",
        subtaskEditorDate ? subtaskEditorDate.toISOString().slice(0, 10) : ""
      );
      const parsed = parseDateInput(input);
      if (parsed) setSubtaskEditorDate(parsed);
      return;
    }
    setShowSubtaskEditorDatePicker(true);
  };

  const openSubtaskEditorTime = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        language === "nl"
          ? "Voer tijd in (HH:MM, 24u):"
          : "Enter a time (HH:MM, 24h):",
        subtaskEditorTime
          ? `${String(subtaskEditorTime.getHours()).padStart(2, "0")}:${String(
              subtaskEditorTime.getMinutes()
            ).padStart(2, "0")}`
          : ""
      );
      const parsed = parseTimeInput(input);
      if (parsed) setSubtaskEditorTime(parsed);
      return;
    }
    setShowSubtaskEditorTimePicker(true);
  };

  const clearSubtaskEditorDeadline = () => {
    setSubtaskEditorDate(null);
    setSubtaskEditorTime(null);
  };

  const handleSubtaskEditorDateChange = (
    event: DateTimePickerEvent,
    date?: Date
  ) => {
    setShowSubtaskEditorDatePicker(false);
    if (event.type === "dismissed") return;
    if (date) setSubtaskEditorDate(date);
  };

  const handleSubtaskEditorTimeChange = (
    event: DateTimePickerEvent,
    time?: Date
  ) => {
    setShowSubtaskEditorTimePicker(false);
    if (event.type === "dismissed") return;
    if (time) setSubtaskEditorTime(time);
  };

  const clearSubtaskEditorImage = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null)
      return;
    const isArchive = subtaskEditorSource === "archive";
    const updatedTodos = [...todos];
    const updatedArchived = [...archivedTodos];
    const parentList = isArchive ? updatedArchived : updatedTodos;
    const parent = parentList[subtaskEditorParentIndex];
    if (!parent) return;
    const existingSub = parent.subtasks[subtaskEditorIndex];
    if (!existingSub) return;
    const updatedSubtasks = [...parent.subtasks];
    updatedSubtasks[subtaskEditorIndex] = {
      ...existingSub,
      image: null,
    };
    parentList[subtaskEditorParentIndex] = {
      ...parent,
      subtasks: updatedSubtasks,
    };
    saveAll(updatedTodos, updatedArchived);
  };

  // Wissel done status voor taak
  const toggleTodo = (index: number) => {
    const updated = [...todos];
    updated[index].done = !updated[index].done;
    saveAll(updated, archivedTodos);
  };

  // Wissel done status voor subtask
  const toggleSubtask = (todoIndex: number, subIndex: number) => {
    const updated = [...todos];
    updated[todoIndex].subtasks[subIndex].done =
      !updated[todoIndex].subtasks[subIndex].done;
    saveAll(updated, archivedTodos);
  };

  // Verwijder taak (met confirm)
  const removeTodo = (index: number) => {
    confirmDelete(
      translations[language].confirmDelete,
      translations[language].deleteTask,
      () =>
        saveAll(
          todos.filter((_, i) => i !== index),
          archivedTodos
        )
    );
  };

  // Archiveer taak: verplaats van todos naar archivedTodos
  const archiveTodo = (index: number) => {
    const todoToArchive = todos[index];
    saveAll(
      todos.filter((_, i) => i !== index),
      [...archivedTodos, todoToArchive]
    );
  };

  // Voeg subtask toe aan bestaande taak (met optionele deadline/tijd)
  const addSubtask = (todoIndex: number) => {
    if (!subtaskText.trim()) {
      showInputWarning(
        language === "nl" ? "Vul een subtaak in." : "Please enter a subtask."
      );
      return;
    }

    const finalDate = combineDateAndTime(subtaskDate, subtaskTime);

    const updatedTodos = [...todos];
    updatedTodos[todoIndex].subtasks.push({
      text: subtaskText,
      done: false,
      deadline: finalDate,
      image: null,
      createdAt: new Date().toISOString(),
      priority: newSubtaskPriority,
    });
    saveAll(updatedTodos, archivedTodos);
    setSubtaskText("");
    setSubtaskDate(null);
    setSubtaskTime(null);
    setNewSubtaskPriority("medium");
    setEditingTodoIndex(null);
  };

  // Afbeelding toevoegen (camera of galerij). Ondersteunt web en native.
  const pickImage = async (
    forSubtask = false,
    todoIndex?: number,
    subIndex?: number,
    isArchive = false,
    fromGallery = false
  ) => {
    const applyImageUpdate = (uri: string) => {
      if (isArchive) {
        const updatedArchived = [...archivedTodos];
        if (forSubtask && todoIndex !== undefined && subIndex !== undefined) {
          updatedArchived[todoIndex].subtasks[subIndex].image = uri;
        } else if (!forSubtask && todoIndex !== undefined) {
          updatedArchived[todoIndex].image = uri;
          if (taskEditorIndex === todoIndex && taskEditorSource === "archive") {
            setTaskEditorSnapshot((prev) =>
              prev ? { ...prev, image: uri } : prev
            );
          }
        }
        saveAll(todos, updatedArchived);
      } else {
        const updatedTodos = [...todos];
        if (forSubtask && todoIndex !== undefined && subIndex !== undefined) {
          updatedTodos[todoIndex].subtasks[subIndex].image = uri;
        } else if (!forSubtask && todoIndex !== undefined) {
          updatedTodos[todoIndex].image = uri;
          if (taskEditorIndex === todoIndex && taskEditorSource === "active") {
            setTaskEditorSnapshot((prev) =>
              prev ? { ...prev, image: uri } : prev
            );
          }
        }
        saveAll(updatedTodos, archivedTodos);
      }
    };

    try {
      if (Platform.OS === "web") {
        // Web: vraag galerij-permissie en gebruik launchImageLibraryAsync
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          alert("Toegang tot je galerij is nodig!");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        });
        if (!result.canceled) {
          const uri = result.assets[0].uri;
          applyImageUpdate(uri);
        }
        return;
      }

      // Native: vraag camera of galerij permissie afhankelijk van fromGallery
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
        applyImageUpdate(uri);
      }
    } catch (e) {
      console.log("Image pick error:", e);
    }
  };

  // Logout: bewaar eerst naar firebase, daarna sign out
  const logout = async () => {
    if (!userId) return;
    await syncGeofenceTargets(userId, []);
    await clearGeofenceTaskState(userId);
    await saveTodosFirebase(userId, todos, archivedTodos);
    await signOut(FIREBASE_AUTH);
  };

  // Parsers voor web prompt inputs (ondersteunt meerdere formaten)
  const parseDateInput = (input: string | null) => {
    if (!input) return null;
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    }
    const dmyMatch = input.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
    if (dmyMatch) {
      return new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00`);
    }
    const parsed = new Date(input || "");
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const parseTimeInput = (input: string | null) => {
    if (!input) return null;
    const tMatch = input.match(/^(\d{1,2}):(\d{2})$/);
    if (!tMatch) return null;
    const d = new Date();
    d.setHours(parseInt(tMatch[1], 10), parseInt(tMatch[2], 10), 0, 0);
    return d;
  };

  // Open date/time pickers: web gebruikt prompts, native DateTimePicker
  const openTaskDate = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        "Voer datum in (YYYY-MM-DD of DD-MM-YYYY):",
        selectedDate ? selectedDate.toISOString().slice(0, 10) : ""
      );
      const parsed = parseDateInput(input);
      if (parsed) setSelectedDate(parsed);
      return;
    }
    setShowDatePicker(true);
  };

  const openTaskTime = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        "Voer tijd in (HH:MM, 24u):",
        selectedTime
          ? `${String(selectedTime.getHours()).padStart(2, "0")}:${String(
              selectedTime.getMinutes()
            ).padStart(2, "0")}`
          : ""
      );
      const parsed = parseTimeInput(input);
      if (parsed) setSelectedTime(parsed);
      return;
    }
    setShowTimePicker(true);
  };

  const openSubtaskDate = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        "Voer datum subtask in (YYYY-MM-DD of DD-MM-YYYY):",
        subtaskDate ? subtaskDate.toISOString().slice(0, 10) : ""
      );
      const parsed = parseDateInput(input);
      if (parsed) setSubtaskDate(parsed);
      return;
    }
    setShowSubtaskDatePicker(true);
  };

  const openSubtaskTime = () => {
    if (Platform.OS === "web") {
      const input = window.prompt(
        "Voer tijd subtask in (HH:MM, 24u):",
        subtaskTime
          ? `${String(subtaskTime.getHours()).padStart(2, "0")}:${String(
              subtaskTime.getMinutes()
            ).padStart(2, "0")}`
          : ""
      );
      const parsed = parseTimeInput(input);
      if (parsed) setSubtaskTime(parsed);
      return;
    }
    setShowSubtaskTimePicker(true);
  };

  const openLocationPicker = async (
    todoIndex?: number,
    source: ListSource = "active"
  ) => {
    if (Platform.OS === "web") {
      showInputWarning(
        language === "nl"
          ? "Locatieselectie wordt op web momenteel niet ondersteund."
          : "Location picking is not supported on web."
      );
      return;
    }

    const editingIndex = typeof todoIndex === "number" ? todoIndex : null;
    const sourceList = source === "archive" ? archivedTodos : todos;
    let seededLocation: LatLng | null = null;
    let seededRegion: Region = { ...DEFAULT_REGION };

    if (editingIndex !== null && sourceList[editingIndex]?.location) {
      const existing = sourceList[editingIndex]?.location;
      if (existing) {
        seededLocation = {
          latitude: existing.latitude,
          longitude: existing.longitude,
        };
      }
    } else if (selectedLocation) {
      seededLocation = {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };
    } else if (mapRegion) {
      seededLocation = {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      };
    }

    if (seededLocation) {
      seededRegion = {
        latitude: seededLocation.latitude,
        longitude: seededLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    setEditingLocationTodoIndex(editingIndex);
    setEditingLocationSource(source);
    setLocationHelperMessage(null);
    setLocationLoading(true);
    setLocationSearchText("");
    setLocationModalVisible(true);

    let workingLocation = seededLocation ? { ...seededLocation } : null;
    let workingRegion = { ...seededRegion };

    try {
      const servicesEnabled =
        (await Location.hasServicesEnabledAsync?.()) ?? true;
      if (!servicesEnabled) {
        setLocationHelperMessage(
          language === "nl"
            ? "Locatieservices staan uit. Kies handmatig een locatie op de kaart."
            : "Location services are disabled. Select a location manually on the map."
        );
      } else if (
        Location?.requestForegroundPermissionsAsync &&
        Location?.getCurrentPositionAsync
      ) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermissionGranted(status === "granted");
        if (status === "granted") {
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            const current =
              lastKnown ??
              (await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              }));
            if (!workingLocation) {
              workingLocation = {
                latitude: current.coords.latitude,
                longitude: current.coords.longitude,
              };
              workingRegion = {
                latitude: workingLocation.latitude,
                longitude: workingLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              };
            }
          } catch (err) {
            console.log("Kon huidige locatie niet ophalen:", err);
            setLocationHelperMessage(
              language === "nl"
                ? "Kon huidige locatie niet ophalen. Kies handmatig een locatie."
                : "Unable to fetch current location. Please pick a spot manually."
            );
          }
        } else {
          setLocationHelperMessage(
            language === "nl"
              ? "Locatietoegang geweigerd. Kies handmatig een locatie op de kaart."
              : "Location access denied. Select a location manually on the map."
          );
        }
      } else {
        setLocationHelperMessage(
          language === "nl"
            ? "expo-location niet beschikbaar. Kies handmatig een locatie op de kaart."
            : "expo-location unavailable. Select a location manually on the map."
        );
      }

      setMapRegion(workingRegion);
      if (workingLocation) {
        setSelectedLocation({ ...workingLocation });
      } else {
        setSelectedLocation(
          (prev) =>
            prev ?? {
              latitude: workingRegion.latitude,
              longitude: workingRegion.longitude,
            }
        );
      }
    } catch (err) {
      console.log("Locatie ophalen mislukt:", err);
      const fallbackRegion = workingLocation
        ? {
            latitude: workingLocation.latitude,
            longitude: workingLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        : { ...DEFAULT_REGION };
      setMapRegion(fallbackRegion);
      setSelectedLocation(workingLocation ? { ...workingLocation } : null);
      setLocationHelperMessage(
        language === "nl"
          ? "Locatie ophalen mislukt."
          : "Failed to fetch location."
      );
    } finally {
      setLocationLoading(false);
    }
  };
  const confirmLocationSelection = () => {
    setLocationModalVisible(false);
    setLocationHelperMessage(null);
    setLocationLoading(false);
    const resolvedLocation = selectedLocation
      ? {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        }
      : null;
    const editingIndex = editingLocationTodoIndex;
    if (editingIndex !== null) {
      const updatedTodos = [...todos];
      const updatedArchived = [...archivedTodos];
      if (editingLocationSource === "archive") {
        if (updatedArchived[editingIndex]) {
          updatedArchived[editingIndex] = {
            ...updatedArchived[editingIndex],
            location: resolvedLocation,
          };
        }
      } else if (updatedTodos[editingIndex]) {
        updatedTodos[editingIndex] = {
          ...updatedTodos[editingIndex],
          location: resolvedLocation,
        };
      }
      saveAll(updatedTodos, updatedArchived);
      if (
        editingIndex === taskEditorIndex &&
        editingLocationSource === taskEditorSource
      ) {
        setTaskEditorSnapshot((prev) =>
          prev ? { ...prev, location: resolvedLocation } : prev
        );
      }
      setSelectedLocation(null);
      setMapRegion(null);
    }
    setEditingLocationTodoIndex(null);
    setEditingLocationSource("active");
    setLocationSearchText("");
  };
  const clearLocationSelection = () => {
    setSelectedLocation(null);
    setMapRegion(DEFAULT_REGION);
    setLocationHelperMessage(null);
    setLocationLoading(false);
    setLocationSearchText("");
  };
  const searchLocationByAddress = async () => {
    const query = locationSearchText.trim();
    if (!query) {
      showInputWarning(
        language === "nl"
          ? "Voer een adres in om te zoeken."
          : "Enter an address to search."
      );
      return;
    }
    if (Platform.OS === "web") {
      setLocationHelperMessage(
        language === "nl"
          ? "Adres zoeken wordt op web niet ondersteund."
          : "Address search is not supported on web."
      );
      return;
    }
    try {
      setLocationHelperMessage(null);
      setLocationLoading(true);
      const results = await Location.geocodeAsync(query);
      if (!results.length) {
        setLocationHelperMessage(translations[language].searchAddressNoResult);
        return;
      }
      const best = results[0];
      const nextLocation = {
        latitude: best.latitude,
        longitude: best.longitude,
      };
      setSelectedLocation(nextLocation);
      setMapRegion({
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setLocationHelperMessage(null);
    } catch (error) {
      console.log("Address geocode failed:", error);
      setLocationHelperMessage(translations[language].searchAddressError);
    } finally {
      setLocationLoading(false);
    }
  };
  const openArchivedLocation = (location: LatLng) => {
    if (Platform.OS === "web") {
      showInputWarning(
        language === "nl"
          ? "Locatieselectie wordt op web momenteel niet ondersteund."
          : "Location picking is not supported on web."
      );
      return;
    }
    setEditingLocationTodoIndex(null);
    setSelectedLocation({ ...location });
    setMapRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setLocationHelperMessage(null);
    setLocationLoading(false);
    setLocationSearchText("");
    setLocationModalVisible(true);
  };
  const updateSelectedLocation = (coord: LatLng) => {
    setSelectedLocation(coord);
    setMapRegion((prev) =>
      prev
        ? { ...prev, latitude: coord.latitude, longitude: coord.longitude }
        : {
            ...DEFAULT_REGION,
            latitude: coord.latitude,
            longitude: coord.longitude,
          }
    );
  };
  const mapFocus = (selectedLocation ?? mapRegion ?? DEFAULT_REGION) as LatLng &
    Partial<Region>;
  const activeMarker = (selectedLocation ?? mapRegion) as
    | (LatLng & Partial<Region>)
    | null;
  const cameraCenter: [number, number] = [
    mapFocus.longitude,
    mapFocus.latitude,
  ];
  const cameraZoom =
    regionToZoomLevel(mapRegion) ??
    (selectedLocation ? SELECTED_CAMERA_ZOOM : DEFAULT_CAMERA_ZOOM);

  const handleMapPress = (event: any) => {
    const coords = extractLonLatFromEvent(event);
    if (coords) {
      updateSelectedLocation(coords);
    }
  };

  const handleMarkerDragEnd = (event: any) => {
    const coords = extractLonLatFromEvent(event);
    if (coords) {
      updateSelectedLocation(coords);
    }
  };

  // Notification handler setup (Expo Notifications)
  if (Platform.OS !== "web") {
    // Registreer hoe lokale meldingen getoond worden op native platforms.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true, // vervangt shouldShowAlert
        shouldShowList: true, // toont ook in notificatiecentrum
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  // Flag die bijhoudt of de gebruiker meldingsrechten heeft gegeven.
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // Set met unieke ids zodat we per deadline maar één melding sturen.
  const notifiedDeadlinesRef = useRef<Set<string>>(new Set());

  // Vraag bij het opstarten meteen om meldingsrechten (alleen native).
  useEffect(() => {
    if (Platform.OS === "web") return;
    // Vraag meldingsrechten éénmalig op nadat het scherm geladen is.
    const requestPermissions = async () => {
      try {
        let status = (await Notifications.getPermissionsAsync()).status;
        if (status !== "granted") {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== "granted") {
          Alert.alert(
            language === "nl"
              ? "Notificaties geweigerd"
              : "Notifications denied",
            language === "nl"
              ? "Schakel notificaties in via de instellingen om deadline-meldingen te ontvangen."
              : "Enable notifications in settings to receive deadline alerts."
          );
          setNotificationsEnabled(false);
          return;
        }
        setNotificationsEnabled(true);
      } catch (err) {
        console.log("Notification permission error:", err);
        setNotificationsEnabled(false);
      }
    };
    requestPermissions();
  }, []);

  // Houd deadlines in de gaten en plan meldingen zodra ze bijna verlopen.
  useEffect(() => {
    if (Platform.OS === "web" || !notificationsEnabled) return;
    // Controleer elke minuut of deadlines binnen de meldingsmomenten vallen.
    const notificationStages = [
      {
        key: "3h",
        ms: 3 * 60 * 60 * 1000,
        taskTitle:
          language === "nl" ? "Deadline binnen 3 uur" : "Deadline in 3 hours",
        taskBody: (taskText: string) =>
          language === "nl"
            ? `Je taak "${taskText}" verloopt over 3 uur.`
            : `Your task "${taskText}" expires in 3 hours.`,
        subTitle:
          language === "nl" ? "Subtaak binnen 3 uur" : "Subtask in 3 hours",
        subBody: (todoText: string, subText: string) =>
          language === "nl"
            ? `De subtaak "${subText}" van "${todoText}" verloopt over 3 uur.`
            : `The subtask "${subText}" for "${todoText}" expires in 3 hours.`,
      },
      {
        key: "2h",
        ms: 2 * 60 * 60 * 1000,
        taskTitle:
          language === "nl" ? "Deadline binnen 2 uur" : "Deadline in 2 hours",
        taskBody: (taskText: string) =>
          language === "nl"
            ? `Je taak "${taskText}" verloopt over 2 uur.`
            : `Your task "${taskText}" expires in 2 hours.`,
        subTitle:
          language === "nl" ? "Subtaak binnen 2 uur" : "Subtask in 2 hours",
        subBody: (todoText: string, subText: string) =>
          language === "nl"
            ? `De subtaak "${subText}" van "${todoText}" verloopt over 2 uur.`
            : `The subtask "${subText}" for "${todoText}" expires in 2 hours.`,
      },
      {
        key: "1h",
        ms: 1 * 60 * 60 * 1000,
        taskTitle:
          language === "nl" ? "Deadline binnen 1 uur" : "Deadline in 1 hour",
        taskBody: (taskText: string) =>
          language === "nl"
            ? `Je taak "${taskText}" verloopt over 1 uur.`
            : `Your task "${taskText}" expires in 1 hour.`,
        subTitle:
          language === "nl" ? "Subtaak binnen 1 uur" : "Subtask in 1 hour",
        subBody: (todoText: string, subText: string) =>
          language === "nl"
            ? `De subtaak "${subText}" van "${todoText}" verloopt over 1 uur.`
            : `The subtask "${subText}" for "${todoText}" expires in 1 hour.`,
      },
      {
        key: "30m",
        ms: 30 * 60 * 1000,
        taskTitle:
          language === "nl"
            ? "Deadline binnen 30 minuten"
            : "Deadline in 30 minutes",
        taskBody: (taskText: string) =>
          language === "nl"
            ? `Je taak "${taskText}" verloopt over 30 minuten.`
            : `Your task "${taskText}" expires in 30 minutes.`,
        subTitle:
          language === "nl"
            ? "Subtaak binnen 30 minuten"
            : "Subtask in 30 minutes",
        subBody: (todoText: string, subText: string) =>
          language === "nl"
            ? `De subtaak "${subText}" van "${todoText}" verloopt over 30 minuten.`
            : `The subtask "${subText}" for "${todoText}" expires in 30 minutes.`,
      },
    ];
    const overdueTaskTitle =
      language === "nl" ? "Deadline verlopen" : "Deadline missed";
    const overdueTaskBody = (taskText: string) =>
      language === "nl"
        ? `De deadline voor "${taskText}" is verstreken.`
        : `The deadline for "${taskText}" has passed.`;
    const overdueSubTitle =
      language === "nl"
        ? "Subtaak deadline verlopen"
        : "Subtask deadline missed";
    const overdueSubBody = (todoText: string, subText: string) =>
      language === "nl"
        ? `De deadline van subtaak "${subText}" bij "${todoText}" is verstreken.`
        : `The subtask "${subText}" in "${todoText}" has passed its deadline.`;
    const checkDeadlines = async () => {
      const now = Date.now();
      const upcoming = new Set<string>();
      for (const todo of todos) {
        if (todo.deadline && !todo.done) {
          const deadlineTime = new Date(todo.deadline).getTime();
          const remaining = deadlineTime - now;
          const baseId = `todo-${todo.createdAt || todo.text}-${todo.deadline}`;
          for (const stage of notificationStages) {
            if (remaining > 0 && remaining <= stage.ms) {
              const stageId = `${baseId}-${stage.key}`;
              upcoming.add(stageId);
              if (!notifiedDeadlinesRef.current.has(stageId)) {
                try {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: stage.taskTitle,
                      body: stage.taskBody(todo.text),
                    },
                    trigger: null,
                  });
                  notifiedDeadlinesRef.current.add(stageId);
                } catch (err) {
                  console.log(
                    `Failed to schedule task notification (${stage.key}):`,
                    err
                  );
                }
              }
            }
          }
          if (remaining <= 0) {
            const overdueId = `${baseId}-overdue`;
            upcoming.add(overdueId);
            if (!notifiedDeadlinesRef.current.has(overdueId)) {
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: overdueTaskTitle,
                    body: overdueTaskBody(todo.text),
                  },
                  trigger: null,
                });
                notifiedDeadlinesRef.current.add(overdueId);
              } catch (err) {
                console.log(
                  "Failed to schedule overdue task notification:",
                  err
                );
              }
            }
          }
        }
        for (const sub of todo.subtasks) {
          if (sub.deadline && !sub.done) {
            const deadlineTime = new Date(sub.deadline).getTime();
            const remaining = deadlineTime - now;
            const baseId = `sub-${todo.createdAt || todo.text}-${
              sub.createdAt || sub.text
            }-${sub.deadline}`;
            for (const stage of notificationStages) {
              if (remaining > 0 && remaining <= stage.ms) {
                const stageId = `${baseId}-${stage.key}`;
                upcoming.add(stageId);
                if (!notifiedDeadlinesRef.current.has(stageId)) {
                  try {
                    await Notifications.scheduleNotificationAsync({
                      content: {
                        title: stage.subTitle,
                        body: stage.subBody(todo.text, sub.text),
                      },
                      trigger: null,
                    });
                    notifiedDeadlinesRef.current.add(stageId);
                  } catch (err) {
                    console.log(
                      `Failed to schedule subtask notification (${stage.key}):`,
                      err
                    );
                  }
                }
              }
            }
            if (remaining <= 0) {
              const overdueId = `${baseId}-overdue`;
              upcoming.add(overdueId);
              if (!notifiedDeadlinesRef.current.has(overdueId)) {
                try {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: overdueSubTitle,
                      body: overdueSubBody(todo.text, sub.text),
                    },
                    trigger: null,
                  });
                  notifiedDeadlinesRef.current.add(overdueId);
                } catch (err) {
                  console.log(
                    "Failed to schedule overdue subtask notification:",
                    err
                  );
                }
              }
            }
          }
        }
      }
      notifiedDeadlinesRef.current.forEach((id) => {
        if (!upcoming.has(id)) {
          notifiedDeadlinesRef.current.delete(id);
        }
      });
    };
    checkDeadlines();
    const interval = setInterval(checkDeadlines, 60000);
    return () => clearInterval(interval);
  }, [todos, language, notificationsEnabled]);

  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      const resetAction = CommonActions.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
      const parentNav = navigation.getParent();
      if (parentNav) parentNav.dispatch(resetAction);
      else navigation.dispatch(resetAction);
    }
  }, [authReady, userId, navigation]);

  const liveEditingTodo =
    taskEditorIndex !== null
      ? taskEditorSource === "archive"
        ? (archivedTodos[taskEditorIndex] ?? null)
        : (todos[taskEditorIndex] ?? null)
      : null;
  const editingTodo = taskEditorSnapshot ?? liveEditingTodo;
  const editorDeadlinePreview =
    taskEditorDate || taskEditorTime
      ? combineDateAndTime(taskEditorDate, taskEditorTime)
      : null;
  const editingSubtask =
    subtaskEditorParentIndex !== null && subtaskEditorIndex !== null
      ? subtaskEditorSource === "archive"
        ? (archivedTodos[subtaskEditorParentIndex]?.subtasks[
            subtaskEditorIndex
          ] ?? null)
        : (todos[subtaskEditorParentIndex]?.subtasks[subtaskEditorIndex] ??
          null)
      : null;
  const subtaskEditorDeadlinePreview =
    subtaskEditorDate || subtaskEditorTime
      ? combineDateAndTime(subtaskEditorDate, subtaskEditorTime)
      : null;

  if (!authReady || !userId) {
    return null;
  }
  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: colors.background }}>
      {/* Header met title, taal en thema toggles */}
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

          {/* Sorteer knop: wissel tussen laatst toegevoegd / eerst toegevoegd */}
          <TouchableOpacity
            onPress={toggleSortOrder}
            style={{
              padding: 8,
              backgroundColor: colors.toggleButton,
              borderRadius: 8,
              marginLeft: 8,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              {sortOrder === "oldest" ? "↓" : "↑"}
            </Text>
          </TouchableOpacity>

          {/* Prioriteit sorteer richting knop: hoog->laag of laag->hoog */}
          <TouchableOpacity
            onPress={togglePrioritySort}
            style={{
              padding: 8,
              backgroundColor: colors.toggleButton,
              borderRadius: 8,
              marginLeft: 8,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              {prioritySort === "highToLow" ? "P↓" : "P↑"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs: Tasks / Archive */}
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

      {locationModalVisible && (
        <Modal
          transparent
          animationType="slide"
          visible={locationModalVisible}
          onRequestClose={confirmLocationSelection}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                margin: 20,
                backgroundColor: colors.formBackground,
                borderRadius: 12,
                overflow: "hidden",
                flex: 0.7,
              }}
            >
              {locationHelperMessage && (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: colors.warningBackground,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.warningText,
                      fontWeight: "500",
                      flex: 1,
                    }}
                  >
                    {locationHelperMessage}
                  </Text>
                  <TouchableOpacity
                    onPress={dismissLocationHelperMessage}
                    style={{ paddingLeft: 12 }}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={colors.warningText}
                    />
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingTop: 12,
                    paddingBottom: 4,
                  }}
                >
                  <TextInput
                    value={locationSearchText}
                    onChangeText={setLocationSearchText}
                    placeholder={
                      translations[language].searchAddressPlaceholder
                    }
                    placeholderTextColor={colors.placeholder}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: "#ccc",
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: Platform.OS === "ios" ? 10 : 8,
                      color: colors.text,
                      marginRight: 8,
                      backgroundColor: theme === "light" ? "#fff" : "#444",
                    }}
                    returnKeyType="search"
                    onSubmitEditing={searchLocationByAddress}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={searchLocationByAddress}
                    disabled={locationLoading}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      backgroundColor: colors.addButton,
                      borderRadius: 8,
                      opacity: locationLoading ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {translations[language].searchAddressButton}
                    </Text>
                  </TouchableOpacity>
                </View>
                <MapLibreGL.MapView
                  style={{ flex: 1 }}
                  mapStyle={MAPLIBRE_STYLE_URL}
                  logoEnabled={false}
                  compassEnabled
                  onPress={handleMapPress}
                >
                  <MapLibreGL.Camera
                    centerCoordinate={cameraCenter}
                    zoomLevel={cameraZoom}
                    animationMode="easeTo"
                    animationDuration={500}
                  />
                  {activeMarker && (
                    <MapLibreGL.PointAnnotation
                      id="selected-location"
                      coordinate={[
                        activeMarker.longitude,
                        activeMarker.latitude,
                      ]}
                      draggable
                      onDragEnd={handleMarkerDragEnd}
                    />
                  )}
                </MapLibreGL.MapView>
                {locationLoading && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.1)",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator size="large" color={colors.addButton} />
                    <Text
                      style={{
                        marginTop: 12,
                        color: colors.text,
                        fontWeight: "500",
                      }}
                    >
                      {language === "nl"
                        ? "Locatie ophalen..."
                        : "Fetching location..."}
                    </Text>
                  </View>
                )}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  padding: 12,
                }}
              >
                <TouchableOpacity onPress={clearLocationSelection}>
                  <Text
                    style={{
                      color: colors.deleteButton,
                      fontWeight: "600",
                    }}
                  >
                    {language === "nl" ? "Verwijder" : "Clear"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmLocationSelection}>
                  <Text style={{ color: colors.addButton, fontWeight: "600" }}>
                    {language === "nl" ? "Bevestigen" : "Confirm"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {subtaskEditorVisible &&
        subtaskEditorParentIndex !== null &&
        subtaskEditorIndex !== null &&
        editingSubtask && (
          <Modal
            transparent
            animationType="slide"
            visible={subtaskEditorVisible}
            onRequestClose={closeSubtaskEditor}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.5)",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  margin: 20,
                  backgroundColor: colors.formBackground,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 12,
                  }}
                >
                  {translations[language].editSubtask}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.text,
                    marginBottom: 6,
                  }}
                >
                  {translations[language].subtaskName}
                </Text>
                <TextInput
                  value={subtaskEditorText}
                  onChangeText={setSubtaskEditorText}
                  placeholder={translations[language].subtaskName}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 10,
                    color: colors.text,
                  }}
                />

                <View
                  style={{
                    flexDirection: "row",
                    marginTop: 12,
                    alignItems: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={openSubtaskEditorDate}
                    style={{
                      padding: 10,
                      backgroundColor: "#6c757d",
                      borderRadius: 8,
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 16 }}>📅</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={openSubtaskEditorTime}
                    style={{
                      padding: 10,
                      backgroundColor: "#6c757d",
                      borderRadius: 8,
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 16 }}>⏰</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearSubtaskEditorDeadline}>
                    <Text style={{ color: colors.deleteButton }}>
                      {translations[language].clearDeadline}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text
                  style={{
                    marginTop: 8,
                    color: colors.text,
                    fontSize: 14,
                  }}
                >
                  {subtaskEditorDeadlinePreview
                    ? formatDate(subtaskEditorDeadlinePreview)
                    : translations[language].noDeadline}
                </Text>

                {showSubtaskEditorDatePicker && Platform.OS !== "web" && (
                  <DateTimePicker
                    value={subtaskEditorDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={handleSubtaskEditorDateChange}
                  />
                )}

                {showSubtaskEditorTimePicker && Platform.OS !== "web" && (
                  <DateTimePicker
                    value={subtaskEditorTime || new Date()}
                    mode="time"
                    display="default"
                    onChange={handleSubtaskEditorTimeChange}
                  />
                )}

                <View style={{ marginTop: 16 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: 6,
                    }}
                  >
                    {translations[language].addPhoto}
                  </Text>
                  {editingSubtask.image ? (
                    <Image
                      source={{ uri: editingSubtask.image }}
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 10,
                        marginBottom: 8,
                      }}
                    />
                  ) : (
                    <Text style={{ color: colors.placeholder }}>
                      {translations[language].noPhoto}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    <TouchableOpacity
                      onPress={() =>
                        subtaskEditorParentIndex !== null &&
                        subtaskEditorIndex !== null &&
                        pickImage(
                          true,
                          subtaskEditorParentIndex,
                          subtaskEditorIndex,
                          subtaskEditorSource === "archive"
                        )
                      }
                      style={{ marginRight: 12, marginBottom: 8 }}
                    >
                      <Text style={{ color: colors.addButton }}>
                        📷 {translations[language].addPhoto}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        subtaskEditorParentIndex !== null &&
                        subtaskEditorIndex !== null &&
                        pickImage(
                          true,
                          subtaskEditorParentIndex,
                          subtaskEditorIndex,
                          subtaskEditorSource === "archive",
                          true
                        )
                      }
                      style={{ marginRight: 12, marginBottom: 8 }}
                    >
                      <Text style={{ color: colors.addButton }}>
                        🖼️ {translations[language].pickFromGallery}
                      </Text>
                    </TouchableOpacity>
                    {editingSubtask.image && (
                      <TouchableOpacity
                        onPress={clearSubtaskEditorImage}
                        style={{ marginBottom: 8 }}
                      >
                        <Text style={{ color: colors.deleteButton }}>
                          ✖ {translations[language].removePhoto}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 20,
                  }}
                >
                  <TouchableOpacity
                    onPress={closeSubtaskEditor}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      backgroundColor: colors.toggleButton,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {translations[language].cancel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveSubtaskEditor}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      backgroundColor: colors.addButton,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {translations[language].saveChanges}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

      {/* Als we het hoofd taken scherm tonen */}
      {!showArchive ? (
        <>
          {/* Formulier om taak toe te voegen + datum/tijd buttons */}
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

            {/* Prioriteit select (kleine knoppen) */}
            <View style={{ flexDirection: "row", marginLeft: 8 }}>
              <TouchableOpacity
                onPress={() => setNewPriority("high")}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: newPriority === "high" ? "#ff6b6b" : "#444",
                  marginRight: 4,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>H</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setNewPriority("medium")}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor:
                    newPriority === "medium" ? "#ffb366" : "#444",
                  marginRight: 4,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>M</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setNewPriority("low")}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: newPriority === "low" ? "#6bc66b" : "#444",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>L</Text>
              </TouchableOpacity>
            </View>

            {/* Datum picker button */}
            <TouchableOpacity
              onPress={openTaskDate}
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

            {/* Tijd picker button */}
            <TouchableOpacity
              onPress={openTaskTime}
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
              onPress={() => openLocationPicker()}
              accessibilityLabel={
                language === "nl" ? "Locatie instellen" : "Set location"
              }
              accessibilityHint={
                language === "nl"
                  ? "Open de kaart om een locatie te kiezen."
                  : "Open the map to choose a location."
              }
              style={{
                marginLeft: 5,
                padding: 10,
                backgroundColor: "#6c757d",
                borderRadius: 8,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff" }}>📍</Text>
            </TouchableOpacity>

            {/* Add knop */}
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

            {/* Native time picker component (alleen niet-web) */}
            {showTimePicker && Platform.OS !== "web" && (
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
          {/* Native datepicker */}
          {showDatePicker && Platform.OS !== "web" && (
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

          {showSubtaskDatePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={subtaskDate || new Date()}
              mode="date"
              display="default"
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowSubtaskDatePicker(false);
                if (date) setSubtaskDate(date);
              }}
            />
          )}

          {showSubtaskTimePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={subtaskTime || new Date()}
              mode="time"
              display="default"
              onChange={(event: DateTimePickerEvent, time?: Date) => {
                setShowSubtaskTimePicker(false);
                if (time) setSubtaskTime(time);
              }}
            />
          )}

          {taskEditorVisible && taskEditorIndex !== null && (
            <Modal
              transparent
              animationType="slide"
              visible={taskEditorVisible}
              onRequestClose={closeTodoEditor}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    margin: 20,
                    backgroundColor: colors.formBackground,
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: colors.text,
                      marginBottom: 12,
                    }}
                  >
                    {translations[language].editTask}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: 6,
                    }}
                  >
                    {translations[language].taskName}
                  </Text>
                  <TextInput
                    value={taskEditorText}
                    onChangeText={setTaskEditorText}
                    placeholder={translations[language].taskName}
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: "#ccc",
                      borderRadius: 8,
                      padding: 10,
                      color: colors.text,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      marginTop: 12,
                      alignItems: "center",
                    }}
                  >
                    <TouchableOpacity
                      onPress={openTaskEditorDate}
                      style={{
                        padding: 10,
                        backgroundColor: "#6c757d",
                        borderRadius: 8,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 16 }}>📅</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={openTaskEditorTime}
                      style={{
                        padding: 10,
                        backgroundColor: "#6c757d",
                        borderRadius: 8,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 16 }}>⏰</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearTaskEditorDeadline}>
                      <Text style={{ color: colors.deleteButton }}>
                        {translations[language].clearDeadline}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text
                    style={{
                      marginTop: 8,
                      color: colors.text,
                      fontSize: 14,
                    }}
                  >
                    {editorDeadlinePreview
                      ? formatDate(editorDeadlinePreview)
                      : translations[language].noDeadline}
                  </Text>

                  {showTaskEditorDatePicker && Platform.OS !== "web" && (
                    <DateTimePicker
                      value={taskEditorDate || new Date()}
                      mode="date"
                      display="default"
                      onChange={handleTaskEditorDateChange}
                    />
                  )}

                  {showTaskEditorTimePicker && Platform.OS !== "web" && (
                    <DateTimePicker
                      value={taskEditorTime || new Date()}
                      mode="time"
                      display="default"
                      onChange={handleTaskEditorTimeChange}
                    />
                  )}

                  <View style={{ marginTop: 16 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.text,
                        marginBottom: 6,
                      }}
                    >
                      {translations[language].addPhoto}
                    </Text>
                    {editingTodo?.image ? (
                      <Image
                        source={{ uri: editingTodo.image }}
                        style={{
                          width: 120,
                          height: 120,
                          borderRadius: 10,
                          marginBottom: 8,
                        }}
                      />
                    ) : (
                      <Text style={{ color: colors.placeholder }}>
                        {translations[language].noPhoto}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      <TouchableOpacity
                        onPress={() =>
                          taskEditorIndex !== null &&
                          pickImage(
                            false,
                            taskEditorIndex,
                            undefined,
                            taskEditorSource === "archive"
                          )
                        }
                        style={{ marginRight: 12, marginBottom: 8 }}
                      >
                        <Text style={{ color: colors.addButton }}>
                          📷 {translations[language].addPhoto}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          taskEditorIndex !== null &&
                          pickImage(
                            false,
                            taskEditorIndex,
                            undefined,
                            taskEditorSource === "archive",
                            true
                          )
                        }
                        style={{ marginRight: 12, marginBottom: 8 }}
                      >
                        <Text style={{ color: colors.addButton }}>
                          🖼️ {translations[language].pickFromGallery}
                        </Text>
                      </TouchableOpacity>
                      {editingTodo?.image && (
                        <TouchableOpacity
                          onPress={() =>
                            taskEditorIndex !== null &&
                            clearTodoImage(taskEditorIndex, taskEditorSource)
                          }
                          style={{ marginBottom: 8 }}
                        >
                          <Text style={{ color: colors.deleteButton }}>
                            ✖ {translations[language].removePhoto}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={{ marginTop: 16 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.text,
                        marginBottom: 6,
                      }}
                    >
                      {translations[language].locationLabel}
                    </Text>
                    {editingTodo?.location ? (
                      <Text style={{ color: colors.text, marginBottom: 8 }}>
                        {editingTodo.location.latitude.toFixed(4)},{" "}
                        {editingTodo.location.longitude.toFixed(4)}
                      </Text>
                    ) : (
                      <Text
                        style={{ color: colors.placeholder, marginBottom: 8 }}
                      >
                        {translations[language].noLocationSelected}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      <TouchableOpacity
                        onPress={() =>
                          taskEditorIndex !== null &&
                          openLocationPicker(taskEditorIndex, taskEditorSource)
                        }
                        style={{ marginRight: 12, marginBottom: 8 }}
                      >
                        <Text style={{ color: colors.addButton }}>
                          📍 {translations[language].updateLocation}
                        </Text>
                      </TouchableOpacity>
                      {editingTodo?.location && (
                        <TouchableOpacity
                          onPress={() =>
                            taskEditorIndex !== null &&
                            clearTodoLocation(taskEditorIndex, taskEditorSource)
                          }
                          style={{ marginBottom: 8 }}
                        >
                          <Text style={{ color: colors.deleteButton }}>
                            ✖ {translations[language].removeLocation}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 20,
                    }}
                  >
                    <TouchableOpacity
                      onPress={closeTodoEditor}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        backgroundColor: colors.toggleButton,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "600" }}>
                        {translations[language].cancel}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveTodoEditor}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        backgroundColor: colors.addButton,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "600" }}>
                        {translations[language].saveChanges}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Lijst met actieve taken (gesorteerd op priority + createdAt) */}
          {(() => {
            const displayTodos = buildDisplayList(todos);
            return (
              <FlatList
                data={displayTodos}
                keyExtractor={(d) => d.originalIndex.toString()}
                renderItem={({ item: displayEntry }) => {
                  const item = displayEntry.item;
                  const originalIndex = displayEntry.originalIndex;
                  // Bereken deadline status voor kleur/waarschuwing
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
                      {/* Bovenste rij met checkbox, tekst, foto en acties */}
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
                            name={
                              item.done ? "checkmark-circle" : "ellipse-outline"
                            }
                            size={24}
                            color={item.done ? "#28a745" : "#6c757d"}
                          />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          {/* Prioriteit label */}
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
                              textDecorationLine: item.done
                                ? "line-through"
                                : "none",
                              color: item.done ? colors.doneText : colors.text,
                            }}
                          >
                            {item.text}
                          </Text>
                          {/* Toon wanneer taak toegevoegd is */}
                          {item.createdAt && (
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#6c757d",
                                marginTop: 4,
                              }}
                            >
                              {(translations[language] as any).added ??
                                (language === "nl" ? "Toegevoegd" : "Added")}
                              : {formatDate(item.createdAt)}
                            </Text>
                          )}
                          {/* Deadline */}
                          {item.deadline && (
                            <Text
                              style={{
                                fontSize: 12,
                                color: deadlinePassed ? "red" : "#6c757d",
                                marginTop: 4,
                              }}
                            >
                              {translations[language].deadline}:{" "}
                              {formatDate(item.deadline)}
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
                                {translations[language].locationLabel}:{" "}
                                {item.location.latitude.toFixed(4)},{" "}
                                {item.location.longitude.toFixed(4)}
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
                          {/* Knoppen om afbeelding toe te voegen (camera / galerij) */}
                          <TouchableOpacity
                            onPress={() => pickImage(false, originalIndex)}
                          >
                            <Text style={{ color: colors.addButton }}>
                              📷 {translations[language].addPhoto}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() =>
                              pickImage(
                                false,
                                originalIndex,
                                undefined,
                                false,
                                true
                              )
                            }
                            style={{ marginTop: 5 }}
                          >
                            <Text style={{ color: colors.addButton }}>
                              🖼️ {translations[language].pickFromGallery}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {/* Bewerken, archiveren en verwijderen */}
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
                        {/* Archiveer en verwijder iconen */}
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
                          <Ionicons
                            name="trash"
                            size={24}
                            color={colors.deleteButton}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Subtasks rendering */}
                      {buildSubtaskDisplay(item.subtasks).map(
                        ({ sub, originalIndex: subIndex }) => {
                          // Toon wanneer subtask toegevoegd is (in sub-UI)
                          const subAddedText = sub.createdAt
                            ? `${
                                (translations[language] as any).added ??
                                (language === "nl" ? "Toegevoegd" : "Added")
                              }: ${formatDate(sub.createdAt)}`
                            : null;
                          const subDeadlineDate = sub.deadline
                            ? new Date(sub.deadline)
                            : null;
                          const isSubSameDay =
                            subDeadlineDate &&
                            subDeadlineDate.getDate() === today.getDate() &&
                            subDeadlineDate.getMonth() === today.getMonth() &&
                            subDeadlineDate.getFullYear() ===
                              today.getFullYear();

                          const subDeadlinePassed =
                            subDeadlineDate &&
                            (subDeadlineDate < today || isSubSameDay);

                          return (
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
                                onPress={() =>
                                  toggleSubtask(originalIndex, subIndex)
                                }
                                style={{ marginRight: 10 }}
                              >
                                <Ionicons
                                  name={
                                    sub.done
                                      ? "checkmark-circle"
                                      : "ellipse-outline"
                                  }
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
                                    textDecorationLine: sub.done
                                      ? "line-through"
                                      : "none",
                                  }}
                                >
                                  {sub.text}
                                </Text>
                                {/* Toon wanneer subtask toegevoegd is */}
                                {sub.createdAt && (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: "#6c757d",
                                      marginTop: 2,
                                    }}
                                  >
                                    {(translations[language] as any).added ??
                                      (language === "nl"
                                        ? "Toegevoegd"
                                        : "Added")}
                                    : {formatDate(sub.createdAt)}
                                  </Text>
                                )}
                                {/* Deadline rood als verlopen/bijna verlopen, anders grijs */}
                                {sub.deadline && (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color:
                                        sub.deadline &&
                                        new Date(sub.deadline) < new Date()
                                          ? "red"
                                          : "#6c757d",
                                      marginTop: 2,
                                    }}
                                  >
                                    {translations[language].deadline}:{" "}
                                    {formatDate(sub.deadline)}
                                  </Text>
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
                                {/* Zet de knoppen onder elkaar */}
                                <View
                                  style={{
                                    flexDirection: "column",
                                    marginTop: 5,
                                  }}
                                >
                                  <TouchableOpacity
                                    onPress={() =>
                                      pickImage(true, originalIndex, subIndex)
                                    }
                                  >
                                    <Text style={{ color: colors.addButton }}>
                                      📷 {translations[language].addPhoto}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() =>
                                      pickImage(
                                        true,
                                        originalIndex,
                                        subIndex,
                                        true,
                                        true
                                      )
                                    }
                                    style={{ marginTop: 5 }}
                                  >
                                    <Text style={{ color: colors.addButton }}>
                                      🖼️{" "}
                                      {translations[language].pickFromGallery}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              <TouchableOpacity
                                onPress={() =>
                                  openSubtaskEditor(originalIndex, subIndex)
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
                                    translations[language].confirmDelete,
                                    translations[language].deleteSubtask,
                                    () => {
                                      const updatedTodos = [...todos];
                                      updatedTodos[originalIndex].subtasks =
                                        updatedTodos[
                                          originalIndex
                                        ].subtasks.filter(
                                          (_, i) => i !== subIndex
                                        );
                                      saveAll(updatedTodos, archivedTodos);
                                    }
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
                        }
                      )}

                      <TouchableOpacity
                        onPress={() => setEditingTodoIndex(originalIndex)}
                        style={{ marginTop: 5 }}
                      >
                        <Text style={{ color: colors.addButton }}>
                          + {translations[language].addSubtask}
                        </Text>
                      </TouchableOpacity>

                      {editingTodoIndex === originalIndex && (
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
                          <View style={{ flexDirection: "row", marginLeft: 5 }}>
                            <TouchableOpacity
                              onPress={() => setNewSubtaskPriority("high")}
                              style={{
                                padding: 6,
                                borderRadius: 8,
                                backgroundColor:
                                  newSubtaskPriority === "high"
                                    ? "#ff6b6b"
                                    : "#444",
                                marginRight: 4,
                              }}
                            >
                              <Text
                                style={{ color: "#fff", fontWeight: "600" }}
                              >
                                H
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setNewSubtaskPriority("medium")}
                              style={{
                                padding: 6,
                                borderRadius: 8,
                                backgroundColor:
                                  newSubtaskPriority === "medium"
                                    ? "#ffb366"
                                    : "#444",
                                marginRight: 4,
                              }}
                            >
                              <Text
                                style={{ color: "#fff", fontWeight: "600" }}
                              >
                                M
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setNewSubtaskPriority("low")}
                              style={{
                                padding: 6,
                                borderRadius: 8,
                                backgroundColor:
                                  newSubtaskPriority === "low"
                                    ? "#6bc66b"
                                    : "#444",
                              }}
                            >
                              <Text
                                style={{ color: "#fff", fontWeight: "600" }}
                              >
                                L
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            onPress={openSubtaskDate}
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
                            onPress={openSubtaskTime}
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
                            onPress={() => addSubtask(originalIndex)}
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
                      )}
                    </View>
                  );
                }}
              />
            );
          })()}
        </>
      ) : (
        <>
          {/* Archive weergave: gebruikzelfde display-sortering (priority + createdAt) */}
          {(() => {
            const displayArchived = buildDisplayList(archivedTodos);
            return (
              <FlatList
                data={displayArchived}
                keyExtractor={(d) => `arch-${d.originalIndex}`}
                renderItem={({ item: entry }) => {
                  const item = entry.item;
                  const originalArchiveIndex = entry.originalIndex;
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
                          flexDirection: "column", // Verander naar column voor betere layout
                          marginBottom: 10,
                        }}
                      >
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <TouchableOpacity
                            onPress={() => {
                              const updatedArchived = [...archivedTodos];
                              updatedArchived[originalArchiveIndex].done =
                                !updatedArchived[originalArchiveIndex].done;
                              saveAll(todos, updatedArchived);
                            }}
                            style={{ marginRight: 15 }}
                          >
                            <Ionicons
                              name={
                                item.done
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={24}
                              color={item.done ? "#28a745" : "#6c757d"}
                            />
                          </TouchableOpacity>

                          <View style={{ flex: 1 }}>
                            {/* Prioriteit label */}
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
                                textDecorationLine: item.done
                                  ? "line-through"
                                  : "none",
                                color: item.done
                                  ? colors.doneText
                                  : colors.text,
                              }}
                            >
                              {item.text}
                            </Text>

                            {/* Toegevoegd datum */}
                            {item.createdAt && (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: "#6c757d",
                                  marginTop: 4,
                                }}
                              >
                                {(translations[language] as any).added ??
                                  (language === "nl" ? "Toegevoegd" : "Added")}
                                : {formatDate(item.createdAt)}
                              </Text>
                            )}

                            {/* Deadline */}
                            {item.deadline && (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: deadlinePassed ? "red" : "#6c757d",
                                  marginTop: 4,
                                }}
                              >
                                {translations[language].deadline}:{" "}
                                {formatDate(item.deadline)}
                              </Text>
                            )}
                            {item.location && (
                              <TouchableOpacity
                                onPress={() =>
                                  openArchivedLocation(item.location!)
                                }
                                accessibilityRole="button"
                                accessibilityHint={
                                  language === "nl"
                                    ? "Bekijk deze taaklocatie op de kaart."
                                    : "View this task location on the map."
                                }
                                style={{
                                  alignSelf: "flex-start",
                                  marginTop: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: "#6c757d",
                                    textDecorationLine: "underline",
                                  }}
                                >
                                  {translations[language].locationLabel}:{" "}
                                  {item.location.latitude.toFixed(4)},{" "}
                                  {item.location.longitude.toFixed(4)}
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
                            {/* Vervang deze View zodat de knoppen onder elkaar staan */}
                            <View style={{ marginTop: 5 }}>
                              <TouchableOpacity
                                onPress={() =>
                                  pickImage(
                                    false,
                                    originalArchiveIndex,
                                    undefined,
                                    true
                                  )
                                }
                              >
                                <Text style={{ color: colors.addButton }}>
                                  📷 {translations[language].addPhoto}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() =>
                                  pickImage(
                                    false,
                                    originalArchiveIndex,
                                    undefined,
                                    true,
                                    true
                                  )
                                }
                                style={{ marginTop: 5 }}
                              >
                                <Text style={{ color: colors.addButton }}>
                                  🖼️ {translations[language].pickFromGallery}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={{ flexDirection: "row" }}>
                            <TouchableOpacity
                              onPress={() =>
                                openTodoEditor(originalArchiveIndex, "archive")
                              }
                              accessibilityLabel={
                                language === "nl"
                                  ? "Taak bewerken"
                                  : "Edit task"
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
                            {/* Undo (unarchive) */}
                            <TouchableOpacity
                              onPress={() => {
                                const todoToUnarchive =
                                  archivedTodos[originalArchiveIndex];
                                saveAll(
                                  [...todos, todoToUnarchive],
                                  archivedTodos.filter(
                                    (_, i) => i !== originalArchiveIndex
                                  )
                                );
                              }}
                              style={{ marginRight: 10 }}
                            >
                              <Ionicons
                                name="arrow-undo"
                                size={24}
                                color="#007bff"
                              />
                            </TouchableOpacity>
                            {/* Permanent verwijderen uit archief */}
                            <TouchableOpacity
                              onPress={() =>
                                confirmDelete(
                                  translations[language].confirmDelete,
                                  translations[language].deleteTask,
                                  () =>
                                    saveAll(
                                      todos,
                                      archivedTodos.filter(
                                        (_, i) => i !== originalArchiveIndex
                                      )
                                    )
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

                        {/* Subtasks in archief */}
                        {item.subtasks.map((sub, subIndex) => {
                          const subAddedText = sub.createdAt
                            ? `${
                                (translations[language] as any).added ??
                                (language === "nl" ? "Toegevoegd" : "Added")
                              }: ${formatDate(sub.createdAt)}`
                            : null;
                          const subDeadlinePassed =
                            sub.deadline && new Date(sub.deadline) < new Date();
                          return (
                            <View
                              key={`arch-${originalArchiveIndex}-sub-${subIndex}`}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginLeft: 25,
                                marginBottom: 5,
                                flexWrap: "wrap", // voeg flexWrap toe voor consistentie
                              }}
                            >
                              <TouchableOpacity
                                onPress={() => {
                                  const updatedArchived = [...archivedTodos];
                                  updatedArchived[
                                    originalArchiveIndex
                                  ].subtasks[subIndex].done =
                                    !updatedArchived[originalArchiveIndex]
                                      .subtasks[subIndex].done;
                                  saveAll(todos, updatedArchived);
                                }}
                                style={{ marginRight: 10 }}
                              >
                                <Ionicons
                                  name={
                                    sub.done
                                      ? "checkmark-circle"
                                      : "ellipse-outline"
                                  }
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
                                    textDecorationLine: sub.done
                                      ? "line-through"
                                      : "none",
                                  }}
                                >
                                  {sub.text}
                                </Text>
                                {/* Toegevoegd grijs, onder naam */}
                                {sub.createdAt && (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: "#6c757d",
                                      marginTop: 2,
                                    }}
                                  >
                                    {(translations[language] as any).added ??
                                      (language === "nl"
                                        ? "Toegevoegd"
                                        : "Added")}
                                    : {formatDate(sub.createdAt)}
                                  </Text>
                                )}
                                {/* Deadline onder toegevoegd, rood als verlopen/bijna verlopen, anders grijs */}
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
                                    {translations[language].deadline}:{" "}
                                    {formatDate(sub.deadline)}
                                  </Text>
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
                                {/* Zet de knoppen onder elkaar */}
                                <View
                                  style={{
                                    flexDirection: "column",
                                    marginTop: 5,
                                  }}
                                >
                                  <TouchableOpacity
                                    onPress={() =>
                                      pickImage(
                                        true,
                                        originalArchiveIndex,
                                        subIndex,
                                        true
                                      )
                                    }
                                  >
                                    <Text style={{ color: colors.addButton }}>
                                      📷 {translations[language].addPhoto}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() =>
                                      pickImage(
                                        true,
                                        originalArchiveIndex,
                                        subIndex,
                                        true,
                                        true
                                      )
                                    }
                                    style={{ marginTop: 5 }}
                                  >
                                    <Text style={{ color: colors.addButton }}>
                                      🖼️{" "}
                                      {translations[language].pickFromGallery}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              <TouchableOpacity
                                onPress={() =>
                                  openSubtaskEditor(
                                    originalArchiveIndex,
                                    subIndex,
                                    "archive"
                                  )
                                }
                                accessibilityLabel={
                                  language === "nl"
                                    ? "Subtaak bewerken"
                                    : "Edit subtask"
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
                                  confirmDelete(
                                    translations[language].confirmDelete,
                                    translations[language].deleteSubtask,
                                    () => {
                                      const updatedArchived = [
                                        ...archivedTodos,
                                      ];
                                      const parent =
                                        updatedArchived[originalArchiveIndex];
                                      if (!parent) return;
                                      const filteredSubtasks =
                                        parent.subtasks.filter(
                                          (_, i) => i !== subIndex
                                        );
                                      updatedArchived[originalArchiveIndex] = {
                                        ...parent,
                                        subtasks: filteredSubtasks,
                                      };
                                      saveAll(todos, updatedArchived);
                                    }
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
                      </View>
                    </View>
                  );
                }}
              />
            );
          })()}
        </>
      )}

      {/* Logout knop (bewaar eerst) */}
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
