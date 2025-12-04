import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  InteractionManager,
  Modal,
  TextInput,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FIREBASE_AUTH } from "../services/FirebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations } from "../constants/translations";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { MapLibreGL, Logger, isMapLibreAvailable } from "../utils/maplibre";
import { Region } from "react-native-maps";
import * as Location from "expo-location";
import {
  initializeGeofenceTask,
  syncGeofenceTargets,
  clearGeofenceTaskState,
} from "../services/background/geofenceTask";
import {
  ListSource,
  ListScreenProps,
  LatLng,
  Todo,
  SubTodo,
} from "./list/types";
import { buildThemeColors } from "./list/theme";
import {
  DEFAULT_REGION,
  MAPLIBRE_STYLE_URL,
  DEFAULT_CAMERA_ZOOM,
  SELECTED_CAMERA_ZOOM,
  regionToZoomLevel,
  extractLonLatFromEvent,
} from "./list/map";
import { saveTodosFirebase, loadTodosFirebase } from "./list/storage";
import LocationModal from "./list/components/LocationModal";
import SubtaskEditorModal from "./list/components/SubtaskEditorModal";
import TaskEditorModal from "./list/components/TaskEditorModal";
import ListHeaderControls from "./list/components/ListHeaderControls";
import TaskCreator from "./list/components/TaskCreator";
import ActiveTodoList from "./list/components/ActiveTodoList";
import ArchivedTodoList from "./list/components/ArchivedTodoList";
import { measureAsync } from "../utils/performance";

// Onthoud de laatst gekozen lijstweergave zodat toggles (zoals thema) het niet resetten.
let lastShowArchive = false;
const NEW_SUBTASK_LOCATION_INDEX = -1;

const makeLocationKey = (location: LatLng) =>
  `${location.latitude.toFixed(6)}:${location.longitude.toFixed(6)}`;

const COORDINATE_DESCRIPTION_REGEX =
  /^-?\d{1,3}(?:\.\d+)?,\s*-?\d{1,3}(?:\.\d+)?$/;

const isCoordinateDescription = (value?: string | null) =>
  typeof value === "string" && COORDINATE_DESCRIPTION_REGEX.test(value.trim());

// Hoofdfunctie van het scherm: toont takenlijst, formulieren en archive
const List: React.FC<ListScreenProps> = ({
  theme,
  toggleTheme,
  language,
  toggleLanguage,
}) => {
  const navigation = useNavigation<any>();
  const [task, setTask] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [archivedTodos, setArchivedTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [subtaskDate, setSubtaskDate] = useState<Date | null>(null);
  const [subtaskTime, setSubtaskTime] = useState<Date | null>(null);
  const [showSubtaskDatePicker, setShowSubtaskDatePicker] = useState(false);
  const [showSubtaskTimePicker, setShowSubtaskTimePicker] = useState(false);
  const [editingTodoIndex, setEditingTodoIndex] = useState<number | null>(null);
  const [showArchive, setShowArchive] = useState(() => lastShowArchive);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">(
    "medium"
  );
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<
    "low" | "medium" | "high"
  >("medium");
  const [newSubtaskLocation, setNewSubtaskLocation] = useState<LatLng | null>(
    null
  );
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [prioritySort, setPrioritySort] = useState<"highToLow" | "lowToHigh">(
    "highToLow"
  );
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);
  const [locationHelperMessage, setLocationHelperMessage] = useState<
    string | null
  >(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSearchText, setLocationSearchText] = useState("");
  const [editingLocationTodoIndex, setEditingLocationTodoIndex] = useState<
    number | null
  >(null);
  const [editingLocationSource, setEditingLocationSource] =
    useState<ListSource>("active");
  const [editingLocationSubtaskIndex, setEditingLocationSubtaskIndex] =
    useState<number | null>(null);
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
  const [webPickerState, setWebPickerState] = useState<{
    mode: "date" | "time";
    title: string;
    placeholder: string;
    confirmLabel: string;
    onConfirm: (value: Date) => void;
  } | null>(null);
  const [webPickerText, setWebPickerText] = useState("");
  const [webPickerError, setWebPickerError] = useState<string | null>(null);
  const [editingTodoSource, setEditingTodoSource] =
    useState<ListSource>("active");
  const [selectedLocationDescription, setSelectedLocationDescription] =
    useState<string | null>(null);
  const [newSubtaskLocationDescription, setNewSubtaskLocationDescription] =
    useState<string | null>(null);
  const processedLocationIdsRef = useRef<Set<string>>(new Set());
  const inflightLocationKeysRef = useRef<Set<string>>(new Set());
  const todosRef = useRef<Todo[]>([]);
  const archivedTodosRef = useRef<Todo[]>([]);

  const colors = useMemo(() => buildThemeColors(theme), [theme]);
  const strings = useMemo(() => translations[language], [language]);

  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    archivedTodosRef.current = archivedTodos;
  }, [archivedTodos]);

  const toggleSortOrder = () =>
    setSortOrder((current) => (current === "oldest" ? "newest" : "oldest"));
  const togglePrioritySort = () =>
    setPrioritySort((current) =>
      current === "highToLow" ? "lowToHigh" : "highToLow"
    );

  const priorityRank = (priority?: "low" | "medium" | "high" | null) => {
    if (priority === "high") return 2;
    if (priority === "medium") return 1;
    return 0;
  };

  const priorityColor = useCallback(
    (priority?: "low" | "medium" | "high" | null) => {
      if (priority === "high") return "#ff6b6b";
      if (priority === "medium") return "#ffb366";
      if (priority === "low") return "#6bc66b";
      return "#6c757d";
    },
    []
  );

  const composeAddressString = useCallback(
    (result: Location.LocationGeocodedAddress | undefined) => {
      if (!result) {
        return null;
      }
      const streetName = result.street ?? null;
      const streetNumber = result.streetNumber ?? null;
      const streetSegmentRaw = streetName
        ? [streetName, streetNumber].filter(Boolean).join(" ")
        : null;
      const streetSegment = streetSegmentRaw?.trim().length
        ? streetSegmentRaw.trim()
        : (result.name?.trim() ?? null);
      const citySegment =
        result.city ??
        result.subregion ??
        result.district ??
        result.region ??
        null;
      const countrySegment = result.country ?? null;
      const parts = [streetSegment, citySegment, countrySegment]
        .filter((part) => part && part.toString().trim().length > 0)
        .map((part) => part!.toString().trim());
      if (!parts.length) {
        return null;
      }
      return parts.join(", ");
    },
    []
  );

  const reverseGeocodeToDescription = useCallback(
    async (location: LatLng | null) => {
      if (!location) {
        return null;
      }
      if (Platform.OS === "web") {
        try {
          const url = new URL("https://nominatim.openstreetmap.org/reverse");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("lat", location.latitude.toString());
          url.searchParams.set("lon", location.longitude.toString());
          url.searchParams.set("zoom", "18");
          url.searchParams.set("addressdetails", "1");

          const response = await fetch(url.toString(), {
            headers: {
              "Accept-Language": language === "nl" ? "nl-NL" : "en-US",
              "User-Agent":
                "galaxiesFire/1.0 (+https://github.com/TiagoJennen)",
            },
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = (await response.json()) as {
            display_name?: string;
            address?: Record<string, string>;
          };
          const address = payload.address ?? {};
          const streetSegment = [address.road, address.house_number]
            .filter(Boolean)
            .join(" ")
            .trim();
          const citySegment =
            address.city ??
            address.town ??
            address.village ??
            address.municipality ??
            address.county ??
            address.suburb ??
            null;
          const countrySegment = address.country ?? null;
          const parts = [
            streetSegment.length ? streetSegment : null,
            citySegment,
            countrySegment,
          ]
            .filter((part) => part && part.toString().trim().length > 0)
            .map((part) => part!.toString().trim());

          if (parts.length) {
            return parts.join(", ");
          }
          if (payload.display_name && payload.display_name.trim().length) {
            return payload.display_name.trim();
          }
        } catch (error) {
          console.log("Reverse geocode (web) failed:", error);
        }
        return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      }
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        return composeAddressString(results[0]);
      } catch (error) {
        console.log("Reverse geocode failed:", error);
        return null;
      }
    },
    [composeAddressString, language]
  );

  const getLocationDisplay = useCallback(
    (location: LatLng | null | undefined, description?: string | null) => {
      if (!location) {
        return "";
      }
      if (description && description.trim().length) {
        return description.trim();
      }
      const key = makeLocationKey(location);
      return inflightLocationKeysRef.current.has(key)
        ? strings.locationLoading
        : strings.locationUnavailable;
    },
    [strings]
  );

  const buildDisplayList = useCallback(
    (list: Todo[]) =>
      list
        .map((item, originalIndex) => ({ item, originalIndex }))
        .sort((a, b) => {
          const priorityDiff =
            prioritySort === "highToLow"
              ? priorityRank(b.item.priority ?? null) -
                priorityRank(a.item.priority ?? null)
              : priorityRank(a.item.priority ?? null) -
                priorityRank(b.item.priority ?? null);
          if (priorityDiff !== 0) return priorityDiff;

          const aTime = a.item.createdAt
            ? new Date(a.item.createdAt).getTime()
            : 0;
          const bTime = b.item.createdAt
            ? new Date(b.item.createdAt).getTime()
            : 0;
          return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
        }),
    [prioritySort, sortOrder]
  );

  const buildSubtaskDisplay = useCallback(
    (list: SubTodo[]) =>
      list
        .map((sub, originalIndex) => ({ sub, originalIndex }))
        .sort((a, b) => {
          const priorityDiff =
            prioritySort === "highToLow"
              ? priorityRank(b.sub.priority ?? null) -
                priorityRank(a.sub.priority ?? null)
              : priorityRank(a.sub.priority ?? null) -
                priorityRank(b.sub.priority ?? null);
          if (priorityDiff !== 0) return priorityDiff;

          const aTime = a.sub.createdAt
            ? new Date(a.sub.createdAt).getTime()
            : 0;
          const bTime = b.sub.createdAt
            ? new Date(b.sub.createdAt).getTime()
            : 0;
          return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
        }),
    [prioritySort, sortOrder]
  );

  const activeDisplayTodos = useMemo(
    () => buildDisplayList(todos),
    [todos, prioritySort, sortOrder]
  );

  const archivedDisplayTodos = useMemo(
    () => buildDisplayList(archivedTodos),
    [archivedTodos, prioritySort, sortOrder]
  );

  const geofenceTargetsFromTodos = useCallback(
    (list: Todo[]) =>
      list
        .filter((todo) => todo.location)
        .map((todo) => ({
          id: `${todo.createdAt ?? todo.text}-${todo.location?.latitude ?? 0}-${
            todo.location?.longitude ?? 0
          }`,
          title: todo.text,
          latitude: todo.location!.latitude,
          longitude: todo.location!.longitude,
        })),
    []
  );

  const formatDate = useCallback(
    (value?: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      return date.toLocaleString(language === "nl" ? "nl-NL" : "en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    },
    [language]
  );

  useEffect(() => {
    let cancelled = false;
    const scheduledTasks: Array<{ cancel?: () => void }> = [];

    const unsubscribe = onAuthStateChanged(FIREBASE_AUTH, (user) => {
      if (!user) {
        AsyncStorage.removeItem("current_user_id").catch((error) =>
          console.log("Failed to clear cached user id:", error)
        );
        if (!cancelled) {
          setUserId(null);
          setTodos([]);
          setArchivedTodos([]);
          setAuthReady(true);
        }
        if (Platform.OS !== "web") {
          const task = InteractionManager.runAfterInteractions(async () => {
            try {
              await clearGeofenceTaskState();
            } catch (clearError) {
              console.log("Failed to clear geofence state:", clearError);
            }
          });
          scheduledTasks.push(task);
        }
        return;
      }

      const uid = user.uid;
      setUserId(uid);
      AsyncStorage.setItem("current_user_id", uid).catch((error) =>
        console.log("Failed to persist current_user_id:", error)
      );

      const task = InteractionManager.runAfterInteractions(async () => {
        if (cancelled) return;
        let readySet = false;

        try {
          const local = await measureAsync("hydrate-local-cache", async () => {
            const [savedTodos, savedArchive] = await Promise.all([
              AsyncStorage.getItem(`todos_${uid}`),
              AsyncStorage.getItem(`archive_${uid}`),
            ]);
            return {
              todos: savedTodos ? JSON.parse(savedTodos) : null,
              archive: savedArchive ? JSON.parse(savedArchive) : null,
            };
          });

          if (!cancelled) {
            if (local.todos) {
              setTodos(local.todos);
            }
            if (local.archive) {
              setArchivedTodos(local.archive);
            }
            setAuthReady(true);
            readySet = true;
          }
        } catch (storageError) {
          if (!cancelled) {
            console.log("Failed to read cached todos:", storageError);
            setAuthReady(true);
            readySet = true;
          }
        }

        if (cancelled) return;

        try {
          const remote = await measureAsync("hydrate-remote-firestore", () =>
            loadTodosFirebase(uid)
          );
          if (cancelled) return;
          setTodos(remote.todos);
          setArchivedTodos(remote.archive);

          await measureAsync("geofence-initialization", async () => {
            try {
              await initializeGeofenceTask();
              const canSyncGeofences =
                locationPermissionGranted || Platform.OS === "web";
              if (canSyncGeofences) {
                await syncGeofenceTargets(
                  uid,
                  geofenceTargetsFromTodos(remote.todos)
                );
              }
            } catch (geoError) {
              console.log("Failed to initialize geofence tracking:", geoError);
            }
          });
        } catch (remoteError) {
          if (!cancelled) {
            console.log("Failed to load todos from Firebase:", remoteError);
          }
        } finally {
          if (!cancelled && !readySet) {
            setAuthReady(true);
          }
        }
      });

      scheduledTasks.push(task);
    });

    return () => {
      cancelled = true;
      scheduledTasks.forEach((task) => task.cancel?.());
      unsubscribe();
    };
  }, [geofenceTargetsFromTodos, locationPermissionGranted]);

  useEffect(() => {
    lastShowArchive = showArchive;
  }, [showArchive]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    try {
      if (MapLibreGL) {
        MapLibreGL.setAccessToken?.("");
        MapLibreGL.setTelemetryEnabled?.(false);
      }
    } catch (error) {
      console.log("MapLibre init error:", error);
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

    if (Logger && isMapLibreAvailable) {
      Logger.setLogCallback(suppressMapLibreNoise);
    }
    return () => {
      if (Logger && isMapLibreAvailable) {
        Logger.setLogCallback(() => false);
      }
    };
  }, []);

  const saveAll = useCallback(
    (newTodos: Todo[], newArchived: Todo[]) => {
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
        AsyncStorage.setItem("todos_local", JSON.stringify(newTodos)).catch(
          (e) => console.log("Fout bij opslaan todos lokaal (local):", e)
        );
        AsyncStorage.setItem(
          "archive_local",
          JSON.stringify(newArchived)
        ).catch((e) =>
          console.log("Fout bij opslaan archief lokaal (local):", e)
        );
      }
      const canSyncGeofences =
        userId && (locationPermissionGranted || Platform.OS === "web");
      if (canSyncGeofences) {
        syncGeofenceTargets(userId, geofenceTargetsFromTodos(newTodos)).catch(
          (err) => console.log("Geofence sync failed:", err)
        );
      }
    },
    [userId, locationPermissionGranted, geofenceTargetsFromTodos]
  );

  useEffect(() => {
    const candidates: Array<{
      id: string;
      key: string;
      location: LatLng;
      apply: (description: string | null) => void;
    }> = [];

    const registerTodo = (source: ListSource, index: number, entry: Todo) => {
      if (
        entry.location &&
        (!entry.locationDescription ||
          isCoordinateDescription(entry.locationDescription))
      ) {
        const location = entry.location;
        const id = `${source}-todo-${index}-${makeLocationKey(location)}`;
        candidates.push({
          id,
          key: makeLocationKey(location),
          location,
          apply: (description: string | null) => {
            const latestTodos = [...todosRef.current];
            const latestArchived = [...archivedTodosRef.current];
            const targetList =
              source === "archive" ? latestArchived : latestTodos;
            const current = targetList[index];
            if (!current || !current.location) {
              return;
            }
            if (
              makeLocationKey(current.location) !== makeLocationKey(location)
            ) {
              return;
            }
            if (
              (current.locationDescription ?? null) === (description ?? null)
            ) {
              return;
            }
            targetList[index] = {
              ...current,
              locationDescription: description ?? null,
            };
            saveAll(latestTodos, latestArchived);
          },
        });
      }
      entry.subtasks.forEach((sub, subIndex) => {
        if (
          sub.location &&
          (!sub.locationDescription ||
            isCoordinateDescription(sub.locationDescription))
        ) {
          const location = sub.location;
          const id = `${source}-sub-${index}-${subIndex}-${makeLocationKey(location)}`;
          candidates.push({
            id,
            key: makeLocationKey(location),
            location,
            apply: (description: string | null) => {
              const latestTodos = [...todosRef.current];
              const latestArchived = [...archivedTodosRef.current];
              const targetList =
                source === "archive" ? latestArchived : latestTodos;
              const current = targetList[index];
              const currentSub = current?.subtasks[subIndex];
              if (!current || !currentSub || !currentSub.location) {
                return;
              }
              if (
                makeLocationKey(currentSub.location) !==
                makeLocationKey(location)
              ) {
                return;
              }
              if (
                (currentSub.locationDescription ?? null) ===
                (description ?? null)
              ) {
                return;
              }
              const updatedSubtasks = [...current.subtasks];
              updatedSubtasks[subIndex] = {
                ...currentSub,
                locationDescription: description ?? null,
              };
              targetList[index] = {
                ...current,
                subtasks: updatedSubtasks,
              };
              saveAll(latestTodos, latestArchived);
            },
          });
        }
      });
    };

    todos.forEach((todo, index) => registerTodo("active", index, todo));
    archivedTodos.forEach((todo, index) =>
      registerTodo("archive", index, todo)
    );

    const next = candidates.find(
      (candidate) =>
        !processedLocationIdsRef.current.has(candidate.id) &&
        !inflightLocationKeysRef.current.has(candidate.key)
    );
    if (!next) {
      return;
    }

    processedLocationIdsRef.current.add(next.id);
    inflightLocationKeysRef.current.add(next.key);

    let cancelled = false;

    (async () => {
      const description = await reverseGeocodeToDescription(next.location);
      inflightLocationKeysRef.current.delete(next.key);
      if (!cancelled) {
        next.apply(description ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [todos, archivedTodos, reverseGeocodeToDescription, saveAll]);

  // Toon bevestigingsdialoog voordat iets verwijderd wordt
  const confirmDelete = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      if (Platform.OS === "web") {
        if (window.confirm(message)) onConfirm();
        return;
      }
      const cancelLabel =
        strings.cancel ?? (language === "nl" ? "Annuleer" : "Cancel");
      const deleteLabel =
        strings.delete ?? (language === "nl" ? "Verwijderen" : "Delete");
      Alert.alert(title, message, [
        {
          text: cancelLabel,
          style: "cancel",
        },
        {
          text: deleteLabel,
          style: "destructive",
          onPress: onConfirm,
        },
      ]);
    },
    [language, strings]
  );

  const showInputWarning = useCallback(
    (message: string) => {
      const title = language === "nl" ? "Let op" : "Warning";
      if (Platform.OS === "web") {
        window.alert(`${title}: ${message}`);
      } else {
        const okLabel = "OK";
        Alert.alert(title, message, [{ text: okLabel }]);
      }
    },
    [language]
  );

  // Combineer datum + tijd naar ISO string (gebruik 00:00 als geen tijd)
  const combineDateAndTime = useCallback(
    (date: Date | null, time: Date | null) => {
      if (!date && !time) return null;
      const d = date ? new Date(date) : new Date();
      if (time) {
        d.setHours(time.getHours(), time.getMinutes(), 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      return d.toISOString();
    },
    []
  );

  // Voeg een nieuwe taak toe met optionele deadline/tijd
  const addTodo = useCallback(
    (target: ListSource = "active") => {
      if (!task.trim()) {
        showInputWarning(strings.taskNameRequired);
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
        locationDescription: selectedLocationDescription,
      };
      if (target === "archive") {
        saveAll(todos, [...archivedTodos, newTodo]);
      } else {
        saveAll([...todos, newTodo], archivedTodos);
      }
      setTask("");
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedLocation(null);
      setSelectedLocationDescription(null);
      setMapRegion(null);
    },
    [
      archivedTodos,
      combineDateAndTime,
      newPriority,
      saveAll,
      selectedDate,
      selectedLocation,
      selectedLocationDescription,
      selectedTime,
      showInputWarning,
      strings,
      task,
      todos,
    ]
  );

  const openTodoEditor = useCallback(
    (index: number, source: ListSource = "active") => {
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
    },
    [archivedTodos, todos]
  );

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
      showInputWarning(strings.taskNameRequired);
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
      openWebPicker("date", taskEditorDate, (value) =>
        setTaskEditorDate(value)
      );
      return;
    }
    setShowTaskEditorDatePicker(true);
  };

  const openTaskEditorTime = () => {
    if (Platform.OS === "web") {
      openWebPicker("time", taskEditorTime, (value) =>
        setTaskEditorTime(value)
      );
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
      updatedArchived[index] = {
        ...updatedArchived[index],
        location: null,
        locationDescription: null,
      };
    } else {
      if (!updatedTodos[index]) return;
      updatedTodos[index] = {
        ...updatedTodos[index],
        location: null,
        locationDescription: null,
      };
    }
    saveAll(updatedTodos, updatedArchived);
    if (taskEditorIndex === index && taskEditorSource === source) {
      setTaskEditorSnapshot((prev) =>
        prev ? { ...prev, location: null, locationDescription: null } : prev
      );
    }
  };

  const updateSubtaskLocation = (
    parentIndex: number,
    subIndex: number,
    location: LatLng | null,
    source: ListSource = "active",
    description?: string | null
  ) => {
    const updatedTodos = [...todos];
    const updatedArchived = [...archivedTodos];
    const targetList = source === "archive" ? updatedArchived : updatedTodos;
    const parent = targetList[parentIndex];
    if (!parent || !parent.subtasks[subIndex]) return;
    const updatedSubtasks = [...parent.subtasks];
    const nextDescription =
      description === undefined
        ? (updatedSubtasks[subIndex].locationDescription ?? null)
        : description;
    updatedSubtasks[subIndex] = {
      ...updatedSubtasks[subIndex],
      location,
      locationDescription: nextDescription,
    };
    targetList[parentIndex] = {
      ...parent,
      subtasks: updatedSubtasks,
    };
    saveAll(updatedTodos, updatedArchived);
  };

  const openSubtaskEditor = useCallback(
    (todoIndex: number, subIndex: number, source: ListSource = "active") => {
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
    },
    [archivedTodos, todos]
  );

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
    setEditingLocationSubtaskIndex(null);
  };

  const saveSubtaskEditor = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null)
      return;
    const trimmed = subtaskEditorText.trim();
    if (!trimmed) {
      showInputWarning(strings.subtaskNameRequired);
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
      openWebPicker("date", subtaskEditorDate, (value) =>
        setSubtaskEditorDate(value)
      );
      return;
    }
    setShowSubtaskEditorDatePicker(true);
  };

  const openSubtaskEditorTime = () => {
    if (Platform.OS === "web") {
      openWebPicker("time", subtaskEditorTime, (value) =>
        setSubtaskEditorTime(value)
      );
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
  const toggleTodo = useCallback(
    (index: number, source: ListSource = "active") => {
      const updatedTodos = [...todos];
      const updatedArchived = [...archivedTodos];
      if (source === "archive") {
        if (!updatedArchived[index]) return;
        updatedArchived[index] = {
          ...updatedArchived[index],
          done: !updatedArchived[index].done,
        };
      } else {
        if (!updatedTodos[index]) return;
        updatedTodos[index] = {
          ...updatedTodos[index],
          done: !updatedTodos[index].done,
        };
      }
      saveAll(updatedTodos, updatedArchived);
    },
    [archivedTodos, saveAll, todos]
  );

  // Wissel done status voor subtask
  const toggleSubtask = useCallback(
    (todoIndex: number, subIndex: number, source: ListSource = "active") => {
      const updatedTodos = [...todos];
      const updatedArchived = [...archivedTodos];
      const targetList = source === "archive" ? updatedArchived : updatedTodos;
      const parent = targetList[todoIndex];
      const sub = parent?.subtasks[subIndex];
      if (!parent || !sub) return;
      const updatedSubtasks = [...parent.subtasks];
      updatedSubtasks[subIndex] = { ...sub, done: !sub.done };
      targetList[todoIndex] = { ...parent, subtasks: updatedSubtasks };
      saveAll(updatedTodos, updatedArchived);
    },
    [archivedTodos, saveAll, todos]
  );

  const removeSubtask = useCallback(
    (todoIndex: number, subIndex: number, source: ListSource = "active") => {
      confirmDelete(strings.confirmDelete, strings.deleteSubtask, () => {
        const updatedTodos = [...todos];
        const updatedArchived = [...archivedTodos];
        const targetList =
          source === "archive" ? updatedArchived : updatedTodos;
        const parent = targetList[todoIndex];
        if (!parent) {
          return;
        }
        const filteredSubtasks = parent.subtasks.filter(
          (_, i) => i !== subIndex
        );
        targetList[todoIndex] = { ...parent, subtasks: filteredSubtasks };
        saveAll(updatedTodos, updatedArchived);
      });
    },
    [archivedTodos, confirmDelete, saveAll, strings, todos]
  );

  const beginInlineSubtaskCreation = useCallback(
    (todoIndex: number, source: ListSource) => {
      setEditingTodoIndex(todoIndex);
      setEditingTodoSource(source);
      setSubtaskText("");
      setSubtaskDate(null);
      setSubtaskTime(null);
      setNewSubtaskPriority("medium");
      setNewSubtaskLocation(null);
      setNewSubtaskLocationDescription(null);
    },
    []
  );

  // Verwijder taak (met confirm)
  const removeTodo = useCallback(
    (index: number) => {
      confirmDelete(strings.confirmDelete, strings.deleteTask, () =>
        saveAll(
          todos.filter((_, i) => i !== index),
          archivedTodos
        )
      );
    },
    [archivedTodos, confirmDelete, saveAll, strings, todos]
  );

  // Archiveer taak: verplaats van todos naar archivedTodos
  const archiveTodo = useCallback(
    (index: number) => {
      const todoToArchive = todos[index];
      saveAll(
        todos.filter((_, i) => i !== index),
        [...archivedTodos, todoToArchive]
      );
    },
    [archivedTodos, saveAll, todos]
  );

  const unarchiveTodo = useCallback(
    (index: number) => {
      const todoToUnarchive = archivedTodos[index];
      if (!todoToUnarchive) {
        return;
      }
      saveAll(
        [...todos, todoToUnarchive],
        archivedTodos.filter((_, i) => i !== index)
      );
    },
    [archivedTodos, saveAll, todos]
  );

  const removeArchivedTodo = useCallback(
    (index: number) => {
      confirmDelete(strings.confirmDelete, strings.deleteTask, () =>
        saveAll(
          todos,
          archivedTodos.filter((_, i) => i !== index)
        )
      );
    },
    [archivedTodos, confirmDelete, saveAll, strings, todos]
  );

  // Voeg subtask toe aan bestaande taak (met optionele deadline/tijd)
  const addSubtask = useCallback(
    (todoIndex: number, source: ListSource = "active") => {
      if (!subtaskText.trim()) {
        showInputWarning(strings.subtaskNameRequired);
        return;
      }

      const finalDate = combineDateAndTime(subtaskDate, subtaskTime);

      const updatedTodos = [...todos];
      const updatedArchived = [...archivedTodos];
      const targetList = source === "archive" ? updatedArchived : updatedTodos;
      const parent = targetList[todoIndex];
      if (!parent) {
        showInputWarning(
          language === "nl"
            ? "Kon de hoofdtaak niet vinden."
            : "Could not find the parent task."
        );
        return;
      }
      const updatedSubtasks = [
        ...parent.subtasks,
        {
          text: subtaskText,
          done: false,
          deadline: finalDate,
          image: null,
          createdAt: new Date().toISOString(),
          priority: newSubtaskPriority,
          location: newSubtaskLocation,
          locationDescription: newSubtaskLocationDescription,
        },
      ];
      targetList[todoIndex] = {
        ...parent,
        subtasks: updatedSubtasks,
      };
      saveAll(updatedTodos, updatedArchived);
      setSubtaskText("");
      setSubtaskDate(null);
      setSubtaskTime(null);
      setNewSubtaskPriority("medium");
      setNewSubtaskLocation(null);
      setNewSubtaskLocationDescription(null);
      setEditingTodoIndex(null);
    },
    [
      archivedTodos,
      combineDateAndTime,
      language,
      strings,
      newSubtaskLocation,
      newSubtaskLocationDescription,
      newSubtaskPriority,
      saveAll,
      showInputWarning,
      subtaskDate,
      subtaskText,
      subtaskTime,
      todos,
    ]
  );

  // Afbeelding toevoegen (camera of galerij). Ondersteunt web en native.
  const pickImage = useCallback(
    async (
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
            if (
              taskEditorIndex === todoIndex &&
              taskEditorSource === "archive"
            ) {
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
            if (
              taskEditorIndex === todoIndex &&
              taskEditorSource === "active"
            ) {
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
    },
    [archivedTodos, saveAll, taskEditorIndex, taskEditorSource, todos]
  );

  // Logout: bewaar eerst naar firebase, daarna sign out
  const logout = useCallback(async () => {
    if (!userId) return;
    await syncGeofenceTargets(userId, []);
    await clearGeofenceTaskState(userId);
    await saveTodosFirebase(userId, todos, archivedTodos);
    await signOut(FIREBASE_AUTH);
  }, [archivedTodos, todos, userId]);

  // Parsers voor web date/time invoer (ondersteunt meerdere formaten)
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
  const formatDateInput = (value: Date | null) =>
    value ? value.toISOString().slice(0, 10) : "";

  const formatTimeInput = (value: Date | null) =>
    value
      ? `${String(value.getHours()).padStart(2, "0")}:${String(
          value.getMinutes()
        ).padStart(2, "0")}`
      : "";

  const resetWebPicker = () => {
    setWebPickerState(null);
    setWebPickerText("");
    setWebPickerError(null);
  };

  const openWebPicker = (
    mode: "date" | "time",
    initialValue: Date | null,
    onConfirm: (value: Date) => void
  ) => {
    if (Platform.OS !== "web") return;
    const isDate = mode === "date";
    const title = isDate
      ? language === "nl"
        ? "Kies een datum"
        : "Select a date"
      : language === "nl"
        ? "Kies een tijd"
        : "Select a time";
    const placeholder = isDate
      ? language === "nl"
        ? "JJJJ-MM-DD of DD-MM-JJJJ"
        : "YYYY-MM-DD or DD-MM-YYYY"
      : language === "nl"
        ? "HH:MM (24u)"
        : "HH:MM (24h)";
    setWebPickerState({
      mode,
      title,
      placeholder,
      confirmLabel: language === "nl" ? "Opslaan" : "Save",
      onConfirm,
    });
    setWebPickerText(
      mode === "date"
        ? formatDateInput(initialValue)
        : formatTimeInput(initialValue)
    );
    setWebPickerError(null);
  };

  const handleWebPickerConfirm = () => {
    if (!webPickerState) return;
    const parser =
      webPickerState.mode === "date" ? parseDateInput : parseTimeInput;
    const parsed = parser(webPickerText.trim());
    if (!parsed) {
      setWebPickerError(
        webPickerState.mode === "date"
          ? language === "nl"
            ? "Voer een geldige datum in."
            : "Enter a valid date."
          : language === "nl"
            ? "Voer een geldige tijd in."
            : "Enter a valid time."
      );
      return;
    }
    webPickerState.onConfirm(parsed);
    resetWebPicker();
  };

  const handleWebPickerCancel = () => {
    resetWebPicker();
  };

  // Open date/time pickers: web gebruikt modal, native DateTimePicker
  const openTaskDate = () => {
    if (Platform.OS === "web") {
      openWebPicker("date", selectedDate, (value) => setSelectedDate(value));
      return;
    }
    setShowDatePicker(true);
  };

  const openTaskTime = () => {
    if (Platform.OS === "web") {
      openWebPicker("time", selectedTime, (value) => setSelectedTime(value));
      return;
    }
    setShowTimePicker(true);
  };

  const openSubtaskDate = () => {
    if (Platform.OS === "web") {
      openWebPicker("date", subtaskDate, (value) => setSubtaskDate(value));
      return;
    }
    setShowSubtaskDatePicker(true);
  };

  const openSubtaskTime = () => {
    if (Platform.OS === "web") {
      openWebPicker("time", subtaskTime, (value) => setSubtaskTime(value));
      return;
    }
    setShowSubtaskTimePicker(true);
  };

  const openLocationPicker = useCallback(
    async (
      todoIndex?: number,
      source: ListSource = "active",
      subtaskIndex: number | null = null
    ) => {
      const editingIndex = typeof todoIndex === "number" ? todoIndex : null;

      const sourceList = source === "archive" ? archivedTodos : todos;
      let seededLocation: LatLng | null = null;
      let seededDescription: string | null = null;
      let seededRegion: Region = { ...DEFAULT_REGION };

      if (editingIndex !== null) {
        if (typeof subtaskIndex === "number") {
          if (subtaskIndex === NEW_SUBTASK_LOCATION_INDEX) {
            if (newSubtaskLocation) {
              seededLocation = { ...newSubtaskLocation };
              seededDescription = newSubtaskLocationDescription ?? null;
            }
          } else {
            const existingSub =
              sourceList[editingIndex]?.subtasks[subtaskIndex];
            if (existingSub?.location) {
              seededLocation = { ...existingSub.location };
              seededDescription = existingSub.locationDescription ?? null;
            }
          }
        } else {
          const existing = sourceList[editingIndex]?.location;
          if (existing) {
            seededLocation = { ...existing };
            seededDescription =
              sourceList[editingIndex]?.locationDescription ?? null;
          }
        }
      }

      if (!seededLocation && selectedLocation) {
        seededLocation = {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        };
        seededDescription = selectedLocationDescription;
      } else if (!seededLocation && mapRegion) {
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
      setEditingLocationSubtaskIndex(
        typeof subtaskIndex === "number" ? subtaskIndex : null
      );
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
        setSelectedLocationDescription(seededDescription ?? null);
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
        setSelectedLocationDescription(seededDescription ?? null);
        setLocationHelperMessage(
          language === "nl"
            ? "Locatie ophalen mislukt."
            : "Failed to fetch location."
        );
      } finally {
        setLocationLoading(false);
      }
    },
    [
      archivedTodos,
      language,
      mapRegion,
      newSubtaskLocation,
      newSubtaskLocationDescription,
      selectedLocation,
      selectedLocationDescription,
      showInputWarning,
      todos,
    ]
  );

  const openInlineSubtaskLocation = useCallback(
    (todoIndex: number, source: ListSource) => {
      openLocationPicker(todoIndex, source, NEW_SUBTASK_LOCATION_INDEX);
    },
    [openLocationPicker]
  );

  const confirmLocationSelection = async () => {
    setLocationModalVisible(false);
    setLocationHelperMessage(null);
    setLocationLoading(false);
    const resolvedLocation = selectedLocation
      ? {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        }
      : null;
    const key = resolvedLocation ? makeLocationKey(resolvedLocation) : null;
    if (key) {
      inflightLocationKeysRef.current.add(key);
    }
    const description = await reverseGeocodeToDescription(resolvedLocation);
    if (key) {
      inflightLocationKeysRef.current.delete(key);
    }
    const editingIndex = editingLocationTodoIndex;
    const subIndex = editingLocationSubtaskIndex;
    if (editingIndex !== null && subIndex !== null) {
      if (subIndex === NEW_SUBTASK_LOCATION_INDEX) {
        setNewSubtaskLocation(resolvedLocation);
        setNewSubtaskLocationDescription(description ?? null);
      } else {
        updateSubtaskLocation(
          editingIndex,
          subIndex,
          resolvedLocation,
          editingLocationSource,
          description ?? null
        );
      }
      setSelectedLocation(null);
      setSelectedLocationDescription(null);
      setMapRegion(null);
    } else if (editingIndex !== null) {
      const updatedTodos = [...todos];
      const updatedArchived = [...archivedTodos];
      if (editingLocationSource === "archive") {
        if (updatedArchived[editingIndex]) {
          updatedArchived[editingIndex] = {
            ...updatedArchived[editingIndex],
            location: resolvedLocation,
            locationDescription: description ?? null,
          };
        }
      } else if (updatedTodos[editingIndex]) {
        updatedTodos[editingIndex] = {
          ...updatedTodos[editingIndex],
          location: resolvedLocation,
          locationDescription: description ?? null,
        };
      }
      saveAll(updatedTodos, updatedArchived);
      if (
        editingIndex === taskEditorIndex &&
        editingLocationSource === taskEditorSource
      ) {
        setTaskEditorSnapshot((prev) =>
          prev
            ? {
                ...prev,
                location: resolvedLocation,
                locationDescription: description ?? null,
              }
            : prev
        );
      }
      setSelectedLocation(null);
      setSelectedLocationDescription(null);
      setMapRegion(null);
    } else {
      setSelectedLocation(resolvedLocation);
      setSelectedLocationDescription(description ?? null);
      if (resolvedLocation) {
        setMapRegion({
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        setMapRegion(null);
      }
    }
    setEditingLocationTodoIndex(null);
    setEditingLocationSubtaskIndex(null);
    setEditingLocationSource("active");
    setLocationSearchText("");
  };
  const clearLocationSelection = () => {
    setSelectedLocation(null);
    setSelectedLocationDescription(null);
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
    setLocationHelperMessage(null);
    setLocationLoading(true);
    try {
      if (Platform.OS === "web") {
        const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          query
        )}`;
        const response = await fetch(endpoint, {
          headers: {
            "Accept-Language": language === "nl" ? "nl-NL" : "en-US",
            "User-Agent": "galaxiesFire/1.0 (+https://github.com/TiagoJennen)",
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as Array<{
          lat?: string;
          lon?: string;
        }>;
        if (!payload.length) {
          setLocationHelperMessage(strings.searchAddressNoResult);
          return;
        }
        const first = payload[0];
        const latitude = parseFloat(first.lat ?? "");
        const longitude = parseFloat(first.lon ?? "");
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
          throw new Error("Invalid coordinates from geocoder");
        }
        const resolved = { latitude, longitude };
        setSelectedLocation(resolved);
        setMapRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        return;
      }

      const results = await Location.geocodeAsync(query);
      if (!results.length) {
        setLocationHelperMessage(strings.searchAddressNoResult);
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
    } catch (error) {
      console.log("Address geocode failed:", error);
      setLocationHelperMessage(strings.searchAddressError);
    } finally {
      setLocationLoading(false);
    }
  };
  const openArchivedLocation = useCallback(
    (location: LatLng, description?: string | null) => {
      setEditingLocationTodoIndex(null);
      setEditingLocationSubtaskIndex(null);
      setSelectedLocation({ ...location });
      setSelectedLocationDescription(description ?? null);
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
    },
    [language, showInputWarning]
  );
  const updateSelectedLocation = (coord: LatLng) => {
    setSelectedLocation(coord);
    setSelectedLocationDescription(null);
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

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // Flag die bijhoudt of de gebruiker meldingsrechten heeft gegeven.
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // Set met unieke ids zodat we per deadline maar één melding sturen.
  const notifiedDeadlinesRef = useRef<Set<string>>(new Set());

  // Vraag bij het opstarten meteen om meldingsrechten (alleen native).
  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setNotificationsEnabled(false);
        return;
      }
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
        return;
      }
      if (Notification.permission === "denied") {
        setNotificationsEnabled(false);
        return;
      }
      Notification.requestPermission()
        .then((result) => {
          setNotificationsEnabled(result === "granted");
        })
        .catch((err) => {
          console.log("Browser notification permission error:", err);
          setNotificationsEnabled(false);
        });
      return;
    }

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
  }, [language]);

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
  const taskEditorDeadlineDisplay = editorDeadlinePreview
    ? formatDate(editorDeadlinePreview)
    : "";
  const subtaskEditorDeadlineDisplay = subtaskEditorDeadlinePreview
    ? formatDate(subtaskEditorDeadlinePreview)
    : "";
  const editingTodoLocationDescription = editingTodo?.location
    ? getLocationDisplay(
        editingTodo.location,
        editingTodo.locationDescription ?? null
      )
    : "";
  const editingSubtaskLocationDescription = editingSubtask?.location
    ? getLocationDisplay(
        editingSubtask.location,
        editingSubtask.locationDescription ?? null
      )
    : "";
  const subtaskModalStrings = useMemo(
    () => ({
      editSubtask: strings.editSubtask,
      subtaskName: strings.subtaskName,
      clearDeadline: strings.clearDeadline,
      noDeadline: strings.noDeadline,
      addPhoto: strings.addPhoto,
      noPhoto: strings.noPhoto,
      pickFromGallery: strings.pickFromGallery,
      removePhoto: strings.removePhoto,
      locationLabel: strings.locationLabel,
      noLocationSelected: strings.noLocationSelected,
      updateLocation: strings.updateLocation,
      removeLocation: strings.removeLocation,
      cancel: strings.cancel,
      saveChanges: strings.saveChanges,
    }),
    [strings]
  );
  const taskModalStrings = useMemo(
    () => ({
      editTask: strings.editTask,
      taskName: strings.taskName,
      clearDeadline: strings.clearDeadline,
      noDeadline: strings.noDeadline,
      addPhoto: strings.addPhoto,
      noPhoto: strings.noPhoto,
      pickFromGallery: strings.pickFromGallery,
      removePhoto: strings.removePhoto,
      locationLabel: strings.locationLabel,
      noLocationSelected: strings.noLocationSelected,
      updateLocation: strings.updateLocation,
      removeLocation: strings.removeLocation,
      cancel: strings.cancel,
      saveChanges: strings.saveChanges,
    }),
    [strings]
  );
  const handleSubtaskEditorPickCamera = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null) {
      return;
    }
    pickImage(
      true,
      subtaskEditorParentIndex,
      subtaskEditorIndex,
      subtaskEditorSource === "archive"
    );
  };
  const handleSubtaskEditorPickGallery = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null) {
      return;
    }
    pickImage(
      true,
      subtaskEditorParentIndex,
      subtaskEditorIndex,
      subtaskEditorSource === "archive",
      true
    );
  };
  const handleSubtaskEditorUpdateLocation = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null) {
      return;
    }
    openLocationPicker(
      subtaskEditorParentIndex,
      subtaskEditorSource,
      subtaskEditorIndex
    );
  };
  const handleSubtaskEditorRemoveLocation = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null) {
      return;
    }
    updateSubtaskLocation(
      subtaskEditorParentIndex,
      subtaskEditorIndex,
      null,
      subtaskEditorSource,
      null
    );
    setSelectedLocation(null);
    setMapRegion(null);
  };
  const handleTaskEditorPickCamera = () => {
    if (taskEditorIndex === null) {
      return;
    }
    pickImage(
      false,
      taskEditorIndex,
      undefined,
      taskEditorSource === "archive"
    );
  };
  const handleTaskEditorPickGallery = () => {
    if (taskEditorIndex === null) {
      return;
    }
    pickImage(
      false,
      taskEditorIndex,
      undefined,
      taskEditorSource === "archive",
      true
    );
  };
  const handleTaskEditorRemoveImage = () => {
    if (taskEditorIndex === null) {
      return;
    }
    clearTodoImage(taskEditorIndex, taskEditorSource);
  };
  const handleTaskEditorUpdateLocation = () => {
    if (taskEditorIndex === null) {
      return;
    }
    openLocationPicker(taskEditorIndex, taskEditorSource);
  };
  const handleTaskEditorRemoveLocation = () => {
    if (taskEditorIndex === null) {
      return;
    }
    clearTodoLocation(taskEditorIndex, taskEditorSource);
  };

  if (!authReady || !userId) {
    return null;
  }
  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: colors.background }}>
      {Platform.OS === "web" && webPickerState && (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={handleWebPickerCancel}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                backgroundColor: colors.formBackground,
                borderRadius: 12,
                padding: 20,
                alignSelf: "center",
                width: "100%",
                maxWidth: 400,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                {webPickerState.title}
              </Text>
              <TextInput
                value={webPickerText}
                onChangeText={(value) => {
                  if (webPickerError) setWebPickerError(null);
                  setWebPickerText(value);
                }}
                placeholder={webPickerState.placeholder}
                placeholderTextColor={colors.placeholder}
                style={{
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: "#ccc",
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  color: colors.text,
                  backgroundColor: theme === "light" ? "#fff" : "#2b2b2b",
                  fontSize: 16,
                }}
                autoFocus
                autoComplete="off"
                importantForAutofill="no"
                keyboardType={
                  webPickerState.mode === "date"
                    ? "default"
                    : "numbers-and-punctuation"
                }
                returnKeyType="done"
                onSubmitEditing={handleWebPickerConfirm}
              />
              {webPickerError && (
                <Text
                  style={{
                    marginTop: 10,
                    color: colors.deleteButton,
                    fontWeight: "600",
                  }}
                >
                  {webPickerError}
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  marginTop: 24,
                }}
              >
                <TouchableOpacity
                  onPress={handleWebPickerCancel}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: colors.toggleButton,
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    {strings.cancel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleWebPickerConfirm}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: 8,
                    backgroundColor: colors.addButton,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    {webPickerState.confirmLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {/* Header met title, taal en thema toggles */}
      <ListHeaderControls
        colors={colors}
        showArchive={showArchive}
        language={language}
        theme={theme}
        sortOrder={sortOrder}
        prioritySort={prioritySort}
        title={showArchive ? strings.archive : strings.tasks}
        tasksLabel={strings.tasks}
        archiveLabel={strings.archive}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
        onToggleSortOrder={toggleSortOrder}
        onTogglePrioritySort={togglePrioritySort}
        onSelectTab={(tab) => setShowArchive(tab === "archive")}
      />

      <LocationModal
        visible={locationModalVisible}
        colors={colors}
        language={language}
        theme={theme}
        helperMessage={locationHelperMessage}
        onDismissHelper={() => setLocationHelperMessage(null)}
        searchText={locationSearchText}
        onChangeSearchText={setLocationSearchText}
        onSearch={searchLocationByAddress}
        loading={locationLoading}
        onClear={clearLocationSelection}
        onConfirm={confirmLocationSelection}
        mapStyleUrl={MAPLIBRE_STYLE_URL}
        cameraCenter={cameraCenter}
        cameraZoom={cameraZoom}
        activeMarker={
          selectedLocation ??
          (mapRegion
            ? {
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              }
            : null)
        }
        onMapPress={handleMapPress}
        onMarkerDragEnd={handleMarkerDragEnd}
      />
      <SubtaskEditorModal
        visible={subtaskEditorVisible}
        colors={colors}
        subtaskText={subtaskEditorText}
        onChangeText={setSubtaskEditorText}
        onOpenDate={openSubtaskEditorDate}
        onOpenTime={openSubtaskEditorTime}
        onClearDeadline={clearSubtaskEditorDeadline}
        deadlinePreview={subtaskEditorDeadlineDisplay}
        showDatePicker={showSubtaskEditorDatePicker}
        showTimePicker={showSubtaskEditorTimePicker}
        dateValue={subtaskEditorDate}
        timeValue={subtaskEditorTime}
        onChangeDate={handleSubtaskEditorDateChange}
        onChangeTime={handleSubtaskEditorTimeChange}
        onClose={closeSubtaskEditor}
        onSave={saveSubtaskEditor}
        onPickCamera={handleSubtaskEditorPickCamera}
        onPickGallery={handleSubtaskEditorPickGallery}
        onRemoveImage={clearSubtaskEditorImage}
        editingSubtask={editingSubtask}
        onUpdateLocation={handleSubtaskEditorUpdateLocation}
        onRemoveLocation={handleSubtaskEditorRemoveLocation}
        location={editingSubtask?.location ?? null}
        locationDescription={editingSubtaskLocationDescription}
        strings={subtaskModalStrings}
      />
      <TaskEditorModal
        visible={taskEditorVisible}
        colors={colors}
        taskText={taskEditorText}
        onChangeText={setTaskEditorText}
        onOpenDate={openTaskEditorDate}
        onOpenTime={openTaskEditorTime}
        onClearDeadline={clearTaskEditorDeadline}
        deadlinePreview={taskEditorDeadlineDisplay}
        showDatePicker={showTaskEditorDatePicker}
        showTimePicker={showTaskEditorTimePicker}
        dateValue={taskEditorDate}
        timeValue={taskEditorTime}
        onChangeDate={handleTaskEditorDateChange}
        onChangeTime={handleTaskEditorTimeChange}
        onClose={closeTodoEditor}
        onSave={saveTodoEditor}
        onPickCamera={handleTaskEditorPickCamera}
        onPickGallery={handleTaskEditorPickGallery}
        onRemoveImage={handleTaskEditorRemoveImage}
        editingTodo={editingTodo}
        onUpdateLocation={handleTaskEditorUpdateLocation}
        onRemoveLocation={handleTaskEditorRemoveLocation}
        locationDescription={editingTodoLocationDescription}
        strings={taskModalStrings}
      />

      {/* Als we het hoofd taken scherm tonen */}
      {!showArchive ? (
        <>
          {/* Formulier om taak toe te voegen + datum/tijd buttons */}
          <TaskCreator
            colors={colors}
            taskText={task}
            onChangeTask={setTask}
            priority={newPriority}
            onSelectPriority={setNewPriority}
            onOpenDate={openTaskDate}
            onOpenTime={openTaskTime}
            onOpenLocation={() => openLocationPicker()}
            onAdd={addTodo}
            placeholder={strings.addTask}
            locationAccessibility={{
              label: language === "nl" ? "Locatie instellen" : "Set location",
              hint:
                language === "nl"
                  ? "Open de kaart om een locatie te kiezen."
                  : "Open the map to choose a location.",
            }}
          />
          {showTimePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={selectedTime || new Date()}
              mode="time"
              display="default"
              onChange={(_event: DateTimePickerEvent, time?: Date) => {
                setShowTimePicker(false);
                if (time) setSelectedTime(time);
              }}
            />
          )}
          {/* Native datepicker */}
          {showDatePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
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
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
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
              onChange={(_event: DateTimePickerEvent, time?: Date) => {
                setShowSubtaskTimePicker(false);
                if (time) setSubtaskTime(time);
              }}
            />
          )}

          {/* Lijst met actieve taken (gesorteerd op priority + createdAt) */}
          <ActiveTodoList
            colors={colors}
            language={language}
            strings={strings}
            displayTodos={activeDisplayTodos}
            buildSubtaskDisplay={buildSubtaskDisplay}
            formatDate={formatDate}
            getLocationDisplay={getLocationDisplay}
            priorityColor={priorityColor}
            toggleTodo={toggleTodo}
            openLocationPicker={openLocationPicker}
            pickImage={pickImage}
            openTodoEditor={openTodoEditor}
            archiveTodo={archiveTodo}
            removeTodo={removeTodo}
            toggleSubtask={toggleSubtask}
            openSubtaskEditor={openSubtaskEditor}
            confirmDelete={confirmDelete}
            removeSubtask={removeSubtask}
            addSubtask={addSubtask}
            beginInlineSubtaskCreation={beginInlineSubtaskCreation}
            openInlineSubtaskLocation={openInlineSubtaskLocation}
            editingTodoIndex={editingTodoIndex}
            editingTodoSource={editingTodoSource}
            subtaskText={subtaskText}
            onChangeSubtaskText={setSubtaskText}
            newSubtaskPriority={newSubtaskPriority}
            onSelectSubtaskPriority={setNewSubtaskPriority}
            openSubtaskDate={openSubtaskDate}
            openSubtaskTime={openSubtaskTime}
          />
        </>
      ) : (
        <>
          <TaskCreator
            colors={colors}
            taskText={task}
            onChangeTask={setTask}
            priority={newPriority}
            onSelectPriority={setNewPriority}
            onOpenDate={openTaskDate}
            onOpenTime={openTaskTime}
            onOpenLocation={() => openLocationPicker(undefined, "archive")}
            onAdd={() => addTodo("archive")}
            placeholder={strings.addTask}
            locationAccessibility={{
              label: language === "nl" ? "Locatie instellen" : "Set location",
              hint:
                language === "nl"
                  ? "Open de kaart om een locatie te kiezen."
                  : "Open the map to choose a location.",
            }}
          />

          {showTimePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={selectedTime || new Date()}
              mode="time"
              display="default"
              onChange={(_event: DateTimePickerEvent, time?: Date) => {
                setShowTimePicker(false);
                if (time) setSelectedTime(time);
              }}
            />
          )}

          {showDatePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
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
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
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
              onChange={(_event: DateTimePickerEvent, time?: Date) => {
                setShowSubtaskTimePicker(false);
                if (time) setSubtaskTime(time);
              }}
            />
          )}

          <ArchivedTodoList
            colors={colors}
            language={language}
            strings={strings}
            displayTodos={archivedDisplayTodos}
            buildSubtaskDisplay={buildSubtaskDisplay}
            formatDate={formatDate}
            getLocationDisplay={getLocationDisplay}
            priorityColor={priorityColor}
            toggleTodo={toggleTodo}
            openLocationPicker={openLocationPicker}
            openArchivedLocation={openArchivedLocation}
            pickImage={pickImage}
            openTodoEditor={openTodoEditor}
            unarchiveTodo={unarchiveTodo}
            removeArchivedTodo={removeArchivedTodo}
            toggleSubtask={toggleSubtask}
            openSubtaskEditor={openSubtaskEditor}
            removeSubtask={removeSubtask}
            addSubtask={addSubtask}
            beginInlineSubtaskCreation={beginInlineSubtaskCreation}
            openInlineSubtaskLocation={openInlineSubtaskLocation}
            editingTodoIndex={editingTodoIndex}
            editingTodoSource={editingTodoSource}
            subtaskText={subtaskText}
            onChangeSubtaskText={setSubtaskText}
            newSubtaskPriority={newSubtaskPriority}
            onSelectSubtaskPriority={setNewSubtaskPriority}
            openSubtaskDate={openSubtaskDate}
            openSubtaskTime={openSubtaskTime}
          />
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
          {strings.logout}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default List;
