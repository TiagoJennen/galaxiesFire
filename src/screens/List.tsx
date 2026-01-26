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
  Pressable,
  ToastAndroid,
  StyleSheet,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { buildThemeColors, ThemeColors } from "./list/theme";
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
import TaskCreatorModal from "./list/components/TaskCreatorModal";
import SubtaskCreatorModal from "./list/components/SubtaskCreatorModal";
import ActiveTodoList from "./list/components/ActiveTodoList";
import ArchivedTodoList from "./list/components/ArchivedTodoList";
import { measureAsync } from "../utils/performance";
import { Ionicons } from "@expo/vector-icons";
import type { FlashListRef } from "@shopify/flash-list";
import type { DisplayTodo } from "./list/components/types";
import {
  pushWebToast,
  subscribeWebToast,
  WebToastTone,
} from "../utils/webToast";

// Onthoud de laatst gekozen lijstweergave zodat toggles (zoals thema) het niet resetten.
let lastShowArchive = false;
let lastSelectedDayTimestamp = (() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
})();
const NEW_SUBTASK_LOCATION_INDEX = -1;

const makeLocationKey = (location: LatLng) =>
  `${location.latitude.toFixed(6)}:${location.longitude.toFixed(6)}`;

const COORDINATE_DESCRIPTION_REGEX =
  /^-?\d{1,3}(?:\.\d+)?,\s*-?\d{1,3}(?:\.\d+)?$/;

const isCoordinateDescription = (value?: string | null) =>
  typeof value === "string" && COORDINATE_DESCRIPTION_REGEX.test(value.trim());

type WebToastEntry = {
  id: string;
  title: string;
  message: string;
  tone: WebToastTone;
  expiresAt: number;
};

const MAX_WEB_TOASTS = 4;

type RecentlyDeletedRecord = {
  todo: Todo;
  source: ListSource;
  index: number;
};

// Hoofdfunctie van het scherm: toont takenlijst, formulieren en archive
const List: React.FC<ListScreenProps> = ({
  theme,
  toggleTheme,
  language,
  toggleLanguage,
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
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
  const [showArchive, setShowArchive] = useState(() => lastShowArchive);
  const [shouldFocusTaskInput, setShouldFocusTaskInput] = useState(false);
  const [taskCreatorVisible, setTaskCreatorVisible] = useState(false);
  const [taskCreatorTarget, setTaskCreatorTarget] = useState<ListSource>(
    lastShowArchive ? "archive" : "active",
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<
    "low" | "medium" | "high"
  >("medium");
  const [newSubtaskLocation, setNewSubtaskLocation] = useState<LatLng | null>(
    null,
  );
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [prioritySort, setPrioritySort] = useState<
    "highToLow" | "lowToHigh" | null
  >(null);
  const [selectedDay, setSelectedDay] = useState(() => {
    const initial = new Date(lastSelectedDayTimestamp);
    initial.setHours(0, 0, 0, 0);
    return initial;
  });
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
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
  const [taskEditorPriority, setTaskEditorPriority] = useState<
    "low" | "medium" | "high"
  >("medium");
  const [showTaskEditorDatePicker, setShowTaskEditorDatePicker] =
    useState(false);
  const [showTaskEditorTimePicker, setShowTaskEditorTimePicker] =
    useState(false);
  const [taskEditorSource, setTaskEditorSource] =
    useState<ListSource>("active");
  const [taskEditorSnapshot, setTaskEditorSnapshot] = useState<Todo | null>(
    null,
  );
  const [subtaskEditorVisible, setSubtaskEditorVisible] = useState(false);
  const [subtaskEditorParentIndex, setSubtaskEditorParentIndex] = useState<
    number | null
  >(null);
  const [subtaskEditorIndex, setSubtaskEditorIndex] = useState<number | null>(
    null,
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
  const [subtaskCreatorVisible, setSubtaskCreatorVisible] = useState(false);
  const [subtaskCreatorParentIndex, setSubtaskCreatorParentIndex] = useState<
    number | null
  >(null);
  const [subtaskCreatorSource, setSubtaskCreatorSource] =
    useState<ListSource>("active");
  const [recentlyDeleted, setRecentlyDeleted] =
    useState<RecentlyDeletedRecord | null>(null);
  // Beheer de inline web datum-/tijdkiezer zodat web dezelfde flow als native volgt.
  const [webPickerState, setWebPickerState] = useState<{
    mode: "date" | "time";
    title: string;
    placeholder: string;
    confirmLabel: string;
    onConfirm: (value: Date) => void;
  } | null>(null);
  const [webPickerText, setWebPickerText] = useState("");
  const [webPickerError, setWebPickerError] = useState<string | null>(null);
  // Browser-toasts worden lokaal bijgehouden zodat meerdere meldingen gestapeld kunnen worden.
  const [webToasts, setWebToasts] = useState<WebToastEntry[]>([]);
  const [selectedLocationDescription, setSelectedLocationDescription] =
    useState<string | null>(null);
  const [newSubtaskLocationDescription, setNewSubtaskLocationDescription] =
    useState<string | null>(null);
  const [webConfirmDialog, setWebConfirmDialog] = useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  }>(null);
  // Houd bij welke locatiebeschrijvingen al verwerkt worden zodat we dubbele requests voorkomen.
  const processedLocationIdsRef = useRef<Set<string>>(new Set());
  const inflightLocationKeysRef = useRef<Set<string>>(new Set());
  const todosRef = useRef<Todo[]>([]);
  const archivedTodosRef = useRef<Todo[]>([]);
  const taskInputRef = useRef<TextInput | null>(null);
  // FlashList refs geven het hoofdscherm controle over scroll-positie bij sorteringen.
  const activeListRef = useRef<FlashListRef<DisplayTodo> | null>(null);
  const archivedListRef = useRef<FlashListRef<DisplayTodo> | null>(null);
  const webConfirmCallbackRef = useRef<(() => void) | null>(null);
  // Koppel timers aan web toasts zodat ze automatisch verdwijnen.
  const webToastTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const recentlyDeletedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const closeTaskCreatorModal = useCallback(() => {
    setTaskCreatorVisible(false);
    setShouldFocusTaskInput(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, []);

  const resetSubtaskDraft = useCallback(() => {
    setSubtaskText("");
    setSubtaskDate(null);
    setSubtaskTime(null);
    setNewSubtaskPriority("medium");
    setNewSubtaskLocation(null);
    setNewSubtaskLocationDescription(null);
  }, []);

  const closeSubtaskCreator = useCallback(() => {
    setSubtaskCreatorVisible(false);
    setSubtaskCreatorParentIndex(null);
    setSubtaskCreatorSource("active");
    resetSubtaskDraft();
    setShowSubtaskDatePicker(false);
    setShowSubtaskTimePicker(false);
  }, [resetSubtaskDraft]);

  // Web krijgt een maatwerkconfirm zodat we geen standaard browser-pop-up hoeven te tonen.
  const openWebConfirm = useCallback(
    (
      title: string,
      message: string,
      confirmLabel: string,
      cancelLabel: string,
      onConfirm: () => void,
    ) => {
      webConfirmCallbackRef.current = onConfirm;
      setWebConfirmDialog({ title, message, confirmLabel, cancelLabel });
    },
    [],
  );

  // Sluit het confirmvenster en wis eventueel opgeslagen callbacks.
  const handleWebConfirmCancel = useCallback(() => {
    setWebConfirmDialog(null);
    webConfirmCallbackRef.current = null;
  }, []);

  // Voer de bevestigde actie uit zodra de gebruiker "Verwijderen" kiest.
  const handleWebConfirmConfirm = useCallback(() => {
    const callback = webConfirmCallbackRef.current;
    setWebConfirmDialog(null);
    webConfirmCallbackRef.current = null;
    callback?.();
  }, []);

  const removeToast = useCallback((id: string) => {
    setWebToasts((current) => current.filter((toast) => toast.id !== id));
    const timers = webToastTimersRef.current;
    const timeoutId = timers[id];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete timers[id];
    }
  }, []);

  const colors = useMemo(() => buildThemeColors(theme), [theme]);
  const webToastStyles = useMemo(
    () => createWebToastStyles(colors, theme),
    [colors, theme],
  );
  const webConfirmStyles = useMemo(
    () => createWebConfirmStyles(colors, theme),
    [colors, theme],
  );
  const floatingAddStyles = useMemo(
    () => createFloatingAddButtonStyles(colors, theme),
    [colors, theme],
  );
  const restoreBannerStyles = useMemo(
    () => createRestoreBannerStyles(colors, theme),
    [colors, theme],
  );
  const restoreBannerBottom = useMemo(() => {
    const base = Platform.OS === "web" ? 32 : 24;
    const additional = Platform.OS === "web" ? 0 : insets.bottom;
    return base + additional;
  }, [insets.bottom]);
  const restoreBannerSides = useMemo(() => {
    const base = 20;
    const additionalLeft = Platform.OS === "web" ? 0 : insets.left;
    const additionalRight = Platform.OS === "web" ? 0 : insets.right;
    return {
      left: base + additionalLeft,
      right: base + additionalRight,
    };
  }, [insets.left, insets.right]);
  const iosPickerStyles = useMemo(
    () => createIOSPickerStyles(colors, theme),
    [colors, theme],
  );
  const strings = useMemo(() => translations[language], [language]);
  const locale = useMemo(
    () => (language === "nl" ? "nl-NL" : "en-US"),
    [language],
  );
  const isViewingToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDay.getTime() === today.getTime();
  }, [selectedDay]);
  const selectedDayLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(selectedDay);
    } catch (error) {
      return selectedDay.toDateString();
    }
  }, [locale, selectedDay]);

  const addTaskButtonLabel =
    language === "nl" ? "Nieuwe hoofdtaak" : "New main task";
  const addTaskButtonHint =
    language === "nl"
      ? "Open het formulier om een hoofdtaak te maken."
      : "Open the form to create a main task.";

  const shiftSelectedDay = useCallback((delta: number) => {
    setSelectedDay((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + delta);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  }, []);

  const goToPreviousDay = useCallback(() => {
    shiftSelectedDay(-1);
  }, [shiftSelectedDay]);

  const goToNextDay = useCallback(() => {
    shiftSelectedDay(1);
  }, [shiftSelectedDay]);

  // Synchroniseer authenticatie, lokale cache en remote Firebase; initialiseert ook geofencing.
  // Voorzie taken achteraf van geocodeerde beschrijvingen zolang er alleen coördinaten bekend zijn.
  // Vraag meldingsrechten aan zodat deadlines pushmeldingen kunnen sturen.
  // Plan herinneringen voor aankomende en verlopen deadlines; ontdubbelt via notifiedDeadlinesRef.
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    archivedTodosRef.current = archivedTodos;
  }, [archivedTodos]);

  useEffect(() => {
    const next = new Date(selectedDay);
    next.setHours(0, 0, 0, 0);
    lastSelectedDayTimestamp = next.getTime();
  }, [selectedDay]);

  useEffect(() => {
    lastShowArchive = showArchive;
  }, [showArchive]);

  useEffect(() => {
    setTaskCreatorTarget(showArchive ? "archive" : "active");
    closeTaskCreatorModal();
    closeSubtaskCreator();
  }, [closeSubtaskCreator, closeTaskCreatorModal, showArchive]);

  useEffect(() => {
    if (!shouldFocusTaskInput || !taskCreatorVisible) {
      return;
    }

    const interaction = InteractionManager.runAfterInteractions(() => {
      const input = taskInputRef.current;
      if (input) {
        input.focus();
      } else {
        setTimeout(() => taskInputRef.current?.focus(), 50);
      }
      setShouldFocusTaskInput(false);
    });

    return () => interaction.cancel();
  }, [shouldFocusTaskInput, taskCreatorVisible]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((current) => (current === "oldest" ? "newest" : "oldest"));
  }, []);
  const togglePrioritySort = useCallback(() => {
    setPrioritySort((current) => {
      if (current === null) return "highToLow";
      if (current === "highToLow") return "lowToHigh";
      return null;
    });
  }, []);

  // Zorg dat de lijst zichtbare items altijd vanaf de top toont na sorteerwijzigingen.
  useEffect(() => {
    const targetRef = showArchive
      ? archivedListRef.current
      : activeListRef.current;
    if (!targetRef) {
      return;
    }
    const resetScroll = () => {
      targetRef.scrollToOffset({ offset: 0, animated: false });
    };
    resetScroll();
    const frame = requestAnimationFrame(resetScroll);
    const timeout = setTimeout(resetScroll, 48);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [sortOrder, prioritySort, showArchive]);

  useEffect(() => {
    // Registreer web toast listeners zodat het scherm eigen meldingen kan renderen.
    if (Platform.OS !== "web") {
      return;
    }
    const unsubscribe = subscribeWebToast((toast) => {
      const tone: WebToastTone = toast.tone ?? "info";
      const duration = Math.min(Math.max(toast.durationMs ?? 3600, 1800), 8000);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: WebToastEntry = {
        id,
        title: toast.title,
        message: toast.message,
        tone,
        expiresAt: Date.now() + duration,
      };

      setWebToasts((current) => {
        const next = [...current];
        const timers = webToastTimersRef.current;
        while (next.length >= MAX_WEB_TOASTS) {
          const removed = next.shift();
          if (removed) {
            const timerId = timers[removed.id];
            if (timerId) {
              clearTimeout(timerId);
              delete timers[removed.id];
            }
          }
        }
        next.push(entry);
        return next;
      });

      const timeoutId = setTimeout(() => {
        removeToast(id);
      }, duration);
      webToastTimersRef.current[id] = timeoutId;
    });

    return () => {
      unsubscribe();
      const timers = webToastTimersRef.current;
      Object.keys(timers).forEach((key) => {
        clearTimeout(timers[key]);
        delete timers[key];
      });
    };
  }, [removeToast]);

  const priorityRank = (priority?: "low" | "medium" | "high" | null) => {
    if (priority === "high") return 2;
    if (priority === "medium") return 1;
    return 0;
  };

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
    [],
  );

  // Haal een mensleesbare beschrijving op voor een LatLng; gebruikt web fallback wanneer native services ontbreken.
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
    [composeAddressString, language],
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
    [strings],
  );

  const shouldIncludeTodo = useCallback(
    (todo: Todo) => {
      if (!todo.deadline) {
        return isViewingToday;
      }
      const deadlineDate = new Date(todo.deadline);
      if (Number.isNaN(deadlineDate.getTime())) {
        return isViewingToday;
      }
      deadlineDate.setHours(0, 0, 0, 0);
      return deadlineDate.getTime() === selectedDay.getTime();
    },
    [isViewingToday, selectedDay],
  );

  // Sorteer en filter taken voor de lijstweergave op basis van geselecteerde dag en gekozen prioriteitsvolgorde.
  const buildDisplayList = useCallback(
    (list: Todo[]) =>
      list
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => shouldIncludeTodo(item))
        .sort((a, b) => {
          if (prioritySort) {
            const priorityDiff =
              prioritySort === "highToLow"
                ? priorityRank(b.item.priority ?? null) -
                  priorityRank(a.item.priority ?? null)
                : priorityRank(a.item.priority ?? null) -
                  priorityRank(b.item.priority ?? null);
            if (priorityDiff !== 0) return priorityDiff;
          }

          const aTime = a.item.createdAt
            ? new Date(a.item.createdAt).getTime()
            : 0;
          const bTime = b.item.createdAt
            ? new Date(b.item.createdAt).getTime()
            : 0;
          return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
        }),
    [prioritySort, shouldIncludeTodo, sortOrder],
  );

  const buildSubtaskDisplay = useCallback(
    (list: SubTodo[]) =>
      list
        .map((sub, originalIndex) => ({ sub, originalIndex }))
        .sort((a, b) => {
          if (prioritySort) {
            const priorityDiff =
              prioritySort === "highToLow"
                ? priorityRank(b.sub.priority ?? null) -
                  priorityRank(a.sub.priority ?? null)
                : priorityRank(a.sub.priority ?? null) -
                  priorityRank(b.sub.priority ?? null);
            if (priorityDiff !== 0) return priorityDiff;
          }

          const aTime = a.sub.createdAt
            ? new Date(a.sub.createdAt).getTime()
            : 0;
          const bTime = b.sub.createdAt
            ? new Date(b.sub.createdAt).getTime()
            : 0;
          return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
        }),
    [prioritySort, sortOrder],
  );

  const activeDisplayTodos = useMemo(
    () => buildDisplayList(todos),
    [buildDisplayList, todos],
  );

  const archivedDisplayTodos = useMemo(
    () => buildDisplayList(archivedTodos),
    [archivedTodos, buildDisplayList],
  );

  // Vertaal taken met locatie naar geofence-targets voor de achtergrondtaak.
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
    [],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale],
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale],
  );

  const formatDate = useCallback(
    (value?: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      const datePart = dateFormatter.format(date);
      const timePart = timeFormatter.format(date);
      return `${datePart}\u00A0${timePart}`;
    },
    [dateFormatter, timeFormatter],
  );

  useEffect(() => {
    let cancelled = false;
    const scheduledTasks: Array<{ cancel?: () => void }> = [];

    const unsubscribe = onAuthStateChanged(FIREBASE_AUTH, (user) => {
      if (!user) {
        AsyncStorage.removeItem("current_user_id").catch((error) =>
          console.log("Failed to clear cached user id:", error),
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
        console.log("Failed to persist current_user_id:", error),
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
            loadTodosFirebase(uid),
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
                  geofenceTargetsFromTodos(remote.todos),
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
          "Request failed due to a permanent error: Canceled",
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

  // Centrale opslagfunctie: werkt state bij, schrijft naar AsyncStorage/Firebase en houdt geofences in sync.
  const saveAll = useCallback(
    (newTodos: Todo[], newArchived: Todo[]) => {
      setTodos(newTodos);
      setArchivedTodos(newArchived);

      if (userId) {
        // Sla lokaal op per gebruiker en push naar firestore
        AsyncStorage.setItem(`todos_${userId}`, JSON.stringify(newTodos)).catch(
          (e) => console.log("Fout bij opslaan todos lokaal:", e),
        );
        AsyncStorage.setItem(
          `archive_${userId}`,
          JSON.stringify(newArchived),
        ).catch((e) => console.log("Fout bij opslaan archief lokaal:", e));
        saveTodosFirebase(userId, newTodos, newArchived);
      } else {
        // Sla lokaal op voor anonieme gebruiker
        AsyncStorage.setItem("todos_local", JSON.stringify(newTodos)).catch(
          (e) => console.log("Fout bij opslaan todos lokaal (local):", e),
        );
        AsyncStorage.setItem(
          "archive_local",
          JSON.stringify(newArchived),
        ).catch((e) =>
          console.log("Fout bij opslaan archief lokaal (local):", e),
        );
      }
      const canSyncGeofences =
        userId && (locationPermissionGranted || Platform.OS === "web");
      if (canSyncGeofences) {
        syncGeofenceTargets(userId, geofenceTargetsFromTodos(newTodos)).catch(
          (err) => console.log("Geofence sync failed:", err),
        );
      }
    },
    [userId, locationPermissionGranted, geofenceTargetsFromTodos],
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
      registerTodo("archive", index, todo),
    );

    const next = candidates.find(
      (candidate) =>
        !processedLocationIdsRef.current.has(candidate.id) &&
        !inflightLocationKeysRef.current.has(candidate.key),
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

  // Toon een platformspecifieke bevestiging voordat iets verwijderd wordt.
  const confirmDelete = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      const cancelLabel =
        strings.cancel ?? (language === "nl" ? "Annuleer" : "Cancel");
      const deleteLabel =
        strings.delete ?? (language === "nl" ? "Verwijderen" : "Delete");
      if (Platform.OS === "web") {
        openWebConfirm(title, message, deleteLabel, cancelLabel, onConfirm);
        return;
      }
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
    [language, openWebConfirm, strings],
  );

  const showInputWarning = useCallback(
    (message: string) => {
      const title = language === "nl" ? "Let op" : "Warning";
      if (Platform.OS === "web") {
        pushWebToast({ title, message, tone: "warning" });
        return;
      }
      const okLabel = "OK";
      Alert.alert(title, message, [{ text: okLabel }]);
    },
    [language],
  );

  const showTaskFeedback = useCallback(
    (
      kind: "added" | "updated" | "deleted",
      target: ListSource,
      options?: { label?: string; entity?: "task" | "subtask" },
    ) => {
      // Bouw een korte statusboodschap op maat van de actie en het platform.
      const isArchiveTarget = target === "archive";
      const rawLabel = options?.label?.trim();
      const label = rawLabel && rawLabel.length ? rawLabel : null;
      const entity = options?.entity ?? "task";
      const isSubtask = entity === "subtask";

      let title: string;
      let message: string;

      if (language === "nl") {
        if (kind === "added") {
          title = "Taak toegevoegd";
          message = isArchiveTarget
            ? "De taak staat nu in je archief."
            : "De taak staat nu in je takenlijst.";
        } else if (kind === "updated") {
          title = "Taak bijgewerkt";
          message = isArchiveTarget
            ? "De taak is bijgewerkt in je archief."
            : "De taak is bijgewerkt in je takenlijst.";
        } else {
          const contextNl = isArchiveTarget
            ? "uit je archief"
            : "uit je takenlijst";
          title = isSubtask ? "Subtaak verwijderd" : "Taak verwijderd";
          if (isSubtask) {
            message = label
              ? `Subtaak "${label}" is verwijderd.`
              : "De subtaak is verwijderd.";
          } else {
            message = label
              ? `Taak "${label}" is ${contextNl} verwijderd.`
              : `De taak is ${contextNl} verwijderd.`;
          }
        }
      } else {
        if (kind === "added") {
          title = "Task added";
          message = isArchiveTarget
            ? "The task is now in your archive."
            : "The task is now in your task list.";
        } else if (kind === "updated") {
          title = "Task updated";
          message = isArchiveTarget
            ? "The task was updated in your archive."
            : "The task was updated in your task list.";
        } else {
          const contextEn = isArchiveTarget
            ? "from your archive"
            : "from your task list";
          title = isSubtask ? "Subtask deleted" : "Task deleted";
          if (isSubtask) {
            message = label
              ? `Subtask "${label}" was removed.`
              : "The subtask was removed.";
          } else {
            message = label
              ? `Task "${label}" was removed ${contextEn}.`
              : `The task was removed ${contextEn}.`;
          }
        }
      }

      if (
        kind === "deleted" &&
        Platform.OS !== "android" &&
        Platform.OS !== "web"
      ) {
        // iOS toont al een bevestigingsdialoog en heeft geen extra toast.
        return;
      }

      if (Platform.OS === "android") {
        ToastAndroid.show(message, ToastAndroid.SHORT);
        return;
      }

      if (Platform.OS === "web") {
        const tone: WebToastTone =
          kind === "deleted" ? "error" : kind === "added" ? "success" : "info";
        pushWebToast({ title, message, tone });
        return;
      }

      const okLabel = "OK";
      Alert.alert(title, message, [{ text: okLabel }]);
    },
    [language],
  );

  const clearRecentlyDeletedTimer = useCallback(() => {
    const timer = recentlyDeletedTimerRef.current;
    if (timer) {
      clearTimeout(timer);
      recentlyDeletedTimerRef.current = null;
    }
  }, []);

  const scheduleRecentlyDeletedReset = useCallback(() => {
    clearRecentlyDeletedTimer();
    recentlyDeletedTimerRef.current = setTimeout(() => {
      setRecentlyDeleted(null);
      recentlyDeletedTimerRef.current = null;
    }, 10000);
  }, [clearRecentlyDeletedTimer]);

  const dismissRecentlyDeleted = useCallback(() => {
    clearRecentlyDeletedTimer();
    setRecentlyDeleted(null);
  }, [clearRecentlyDeletedTimer]);

  const handleRestoreRecentlyDeleted = useCallback(() => {
    if (!recentlyDeleted) {
      return;
    }
    const { todo: deletedTodo, source, index } = recentlyDeleted;
    const nextTodos = [...todos];
    const nextArchived = [...archivedTodos];
    if (source === "archive") {
      const insertIndex = Math.min(index, nextArchived.length);
      nextArchived.splice(insertIndex, 0, deletedTodo);
    } else {
      const insertIndex = Math.min(index, nextTodos.length);
      nextTodos.splice(insertIndex, 0, deletedTodo);
    }
    saveAll(nextTodos, nextArchived);
    showTaskFeedback("added", source, { label: deletedTodo.text });
    clearRecentlyDeletedTimer();
    setRecentlyDeleted(null);
  }, [
    archivedTodos,
    clearRecentlyDeletedTimer,
    recentlyDeleted,
    saveAll,
    showTaskFeedback,
    todos,
  ]);

  useEffect(() => {
    return () => {
      clearRecentlyDeletedTimer();
    };
  }, [clearRecentlyDeletedTimer]);

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
    [],
  );

  const handleHeaderAddTask = useCallback(() => {
    setTaskCreatorTarget(showArchive ? "archive" : "active");
    setTaskCreatorVisible(true);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, [showArchive]);

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
      showTaskFeedback("added", target);
      setTask("");
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedLocation(null);
      setSelectedLocationDescription(null);
      setMapRegion(null);
      closeTaskCreatorModal();
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
      showTaskFeedback,
      strings,
      task,
      todos,
      closeTaskCreatorModal,
    ],
  );

  const handleTaskCreatorAdd = useCallback(() => {
    addTodo(taskCreatorTarget);
  }, [addTodo, taskCreatorTarget]);

  const openTodoEditor = useCallback(
    (index: number, source: ListSource = "active") => {
      const list = source === "archive" ? archivedTodos : todos;
      const target = list[index];
      if (!target) return;
      setTaskEditorSource(source);
      setTaskEditorIndex(index);
      setTaskEditorText(target.text);
      const nextPriority =
        target.priority === "high" ||
        target.priority === "low" ||
        target.priority === "medium"
          ? target.priority
          : "medium";
      setTaskEditorPriority(nextPriority);
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
    [archivedTodos, todos],
  );

  const closeTodoEditor = () => {
    setTaskEditorVisible(false);
    setTaskEditorIndex(null);
    setTaskEditorText("");
    setTaskEditorDate(null);
    setTaskEditorTime(null);
    setTaskEditorPriority("medium");
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
      priority: taskEditorPriority,
    };
    saveAll(updatedTodos, updatedArchived);
    showTaskFeedback("updated", isArchive ? "archive" : "active");
    closeTodoEditor();
  };

  const openTaskEditorDate = () => {
    Keyboard.dismiss();
    if (Platform.OS === "web") {
      openWebPicker("date", taskEditorDate, (value) =>
        setTaskEditorDate(value),
      );
      return;
    }
    setShowTaskEditorTimePicker(false);
    setShowTaskEditorDatePicker(true);
  };

  const openTaskEditorTime = () => {
    Keyboard.dismiss();
    if (Platform.OS === "web") {
      openWebPicker("time", taskEditorTime, (value) =>
        setTaskEditorTime(value),
      );
      return;
    }
    setShowTaskEditorDatePicker(false);
    setShowTaskEditorTimePicker(true);
  };

  const clearTaskEditorDeadline = () => {
    setTaskEditorDate(null);
    setTaskEditorTime(null);
  };

  const handleTaskEditorDateChange = (
    event: DateTimePickerEvent,
    date?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowTaskEditorDatePicker(false);
      return;
    }
    if (date) setTaskEditorDate(date);
    if (Platform.OS === "android") {
      setShowTaskEditorDatePicker(false);
    }
  };

  const handleTaskEditorTimeChange = (
    event: DateTimePickerEvent,
    time?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowTaskEditorTimePicker(false);
      return;
    }
    if (time) setTaskEditorTime(time);
    if (Platform.OS === "android") {
      setShowTaskEditorTimePicker(false);
    }
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
        prev ? { ...prev, location: null, locationDescription: null } : prev,
      );
    }
  };

  const updateSubtaskLocation = (
    parentIndex: number,
    subIndex: number,
    location: LatLng | null,
    source: ListSource = "active",
    description?: string | null,
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
    [archivedTodos, todos],
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
    Keyboard.dismiss();
    if (Platform.OS === "web") {
      openWebPicker("date", subtaskEditorDate, (value) =>
        setSubtaskEditorDate(value),
      );
      return;
    }
    setShowSubtaskEditorTimePicker(false);
    setShowSubtaskEditorDatePicker(true);
  };

  const openSubtaskEditorTime = () => {
    Keyboard.dismiss();
    if (Platform.OS === "web") {
      openWebPicker("time", subtaskEditorTime, (value) =>
        setSubtaskEditorTime(value),
      );
      return;
    }
    setShowSubtaskEditorDatePicker(false);
    setShowSubtaskEditorTimePicker(true);
  };

  const clearSubtaskEditorDeadline = () => {
    setSubtaskEditorDate(null);
    setSubtaskEditorTime(null);
  };

  const handleSubtaskEditorDateChange = (
    event: DateTimePickerEvent,
    date?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowSubtaskEditorDatePicker(false);
      return;
    }
    if (date) setSubtaskEditorDate(date);
    if (Platform.OS === "android") {
      setShowSubtaskEditorDatePicker(false);
    }
  };

  const handleSubtaskEditorTimeChange = (
    event: DateTimePickerEvent,
    time?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowSubtaskEditorTimePicker(false);
      return;
    }
    if (time) setSubtaskEditorTime(time);
    if (Platform.OS === "android") {
      setShowSubtaskEditorTimePicker(false);
    }
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
    [archivedTodos, saveAll, todos],
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
    [archivedTodos, saveAll, todos],
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
        const removedSubtask = parent.subtasks[subIndex];
        const filteredSubtasks = parent.subtasks.filter(
          (_, i) => i !== subIndex,
        );
        targetList[todoIndex] = { ...parent, subtasks: filteredSubtasks };
        saveAll(updatedTodos, updatedArchived);
        showTaskFeedback("deleted", source, {
          entity: "subtask",
          label: removedSubtask?.text,
        });
      });
    },
    [archivedTodos, confirmDelete, saveAll, showTaskFeedback, strings, todos],
  );

  const beginInlineSubtaskCreation = useCallback(
    (todoIndex: number, source: ListSource) => {
      resetSubtaskDraft();
      setSubtaskCreatorParentIndex(todoIndex);
      setSubtaskCreatorSource(source);
      setSubtaskCreatorVisible(true);
    },
    [resetSubtaskDraft],
  );

  // Verwijder taak (met confirm)
  const removeTodo = useCallback(
    (index: number) => {
      confirmDelete(strings.confirmDelete, strings.deleteTask, () => {
        const removed = todos[index];
        saveAll(
          todos.filter((_, i) => i !== index),
          archivedTodos,
        );
        showTaskFeedback("deleted", "active", {
          label: removed?.text,
        });
        if (removed) {
          setRecentlyDeleted({
            todo: removed,
            source: "active",
            index,
          });
          scheduleRecentlyDeletedReset();
        }
      });
    },
    [
      archivedTodos,
      confirmDelete,
      saveAll,
      scheduleRecentlyDeletedReset,
      showTaskFeedback,
      strings,
      todos,
    ],
  );

  // Archiveer taak: verplaats van todos naar archivedTodos
  const archiveTodo = useCallback(
    (index: number) => {
      const todoToArchive = todos[index];
      if (!todoToArchive) {
        return;
      }
      saveAll(
        todos.filter((_, i) => i !== index),
        [...archivedTodos, todoToArchive],
      );
      showTaskFeedback("updated", "archive");
    },
    [archivedTodos, saveAll, showTaskFeedback, todos],
  );

  const unarchiveTodo = useCallback(
    (index: number) => {
      const todoToUnarchive = archivedTodos[index];
      if (!todoToUnarchive) {
        return;
      }
      saveAll(
        [...todos, todoToUnarchive],
        archivedTodos.filter((_, i) => i !== index),
      );
      showTaskFeedback("updated", "active");
    },
    [archivedTodos, saveAll, showTaskFeedback, todos],
  );

  const removeArchivedTodo = useCallback(
    (index: number) => {
      confirmDelete(strings.confirmDelete, strings.deleteTask, () => {
        const removed = archivedTodos[index];
        saveAll(
          todos,
          archivedTodos.filter((_, i) => i !== index),
        );
        showTaskFeedback("deleted", "archive", {
          label: removed?.text,
        });
        if (removed) {
          setRecentlyDeleted({
            todo: removed,
            source: "archive",
            index,
          });
          scheduleRecentlyDeletedReset();
        }
      });
    },
    [
      archivedTodos,
      confirmDelete,
      saveAll,
      scheduleRecentlyDeletedReset,
      showTaskFeedback,
      strings,
      todos,
    ],
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
            : "Could not find the parent task.",
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
      showTaskFeedback("added", source);
      closeSubtaskCreator();
    },
    [
      archivedTodos,
      combineDateAndTime,
      language,
      strings,
      newSubtaskLocation,
      newSubtaskLocationDescription,
      newSubtaskPriority,
      closeSubtaskCreator,
      saveAll,
      showInputWarning,
      showTaskFeedback,
      subtaskDate,
      subtaskText,
      subtaskTime,
      todos,
    ],
  );

  // Afbeelding toevoegen (camera of galerij). Ondersteunt web en native.
  // Afbeeldingskeuze werkt zowel voor camera als galerij en houdt editors in sync.
  const pickImage = useCallback(
    async (
      forSubtask = false,
      todoIndex?: number,
      subIndex?: number,
      isArchive = false,
      fromGallery = false,
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
                prev ? { ...prev, image: uri } : prev,
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
                prev ? { ...prev, image: uri } : prev,
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
              : "Camera toegang is nodig!",
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
    [archivedTodos, saveAll, taskEditorIndex, taskEditorSource, todos],
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
          value.getMinutes(),
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
    onConfirm: (value: Date) => void,
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
        : formatTimeInput(initialValue),
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
            : "Enter a valid time.",
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
    Keyboard.dismiss();
    if (__DEV__) {
      console.log("[picker] openTaskDate");
    }
    if (Platform.OS === "web") {
      openWebPicker("date", selectedDate, (value) => setSelectedDate(value));
      return;
    }
    setShowTimePicker(false);
    setShowDatePicker(true);
  };

  const openTaskTime = () => {
    Keyboard.dismiss();
    if (__DEV__) {
      console.log("[picker] openTaskTime");
    }
    if (Platform.OS === "web") {
      openWebPicker("time", selectedTime, (value) => setSelectedTime(value));
      return;
    }
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const openSubtaskDate = () => {
    Keyboard.dismiss();
    if (__DEV__) {
      console.log("[picker] openSubtaskDate");
    }
    if (Platform.OS === "web") {
      openWebPicker("date", subtaskDate, (value) => setSubtaskDate(value));
      return;
    }
    setShowSubtaskTimePicker(false);
    setShowSubtaskDatePicker(true);
  };

  const openSubtaskTime = () => {
    Keyboard.dismiss();
    if (__DEV__) {
      console.log("[picker] openSubtaskTime");
    }
    if (Platform.OS === "web") {
      openWebPicker("time", subtaskTime, (value) => setSubtaskTime(value));
      return;
    }
    setShowSubtaskDatePicker(false);
    setShowSubtaskTimePicker(true);
  };

  const closeTaskCreatorDatePicker = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const closeTaskCreatorTimePicker = useCallback(() => {
    setShowTimePicker(false);
  }, []);

  const closeSubtaskCreatorDatePicker = useCallback(() => {
    setShowSubtaskDatePicker(false);
  }, []);

  const closeSubtaskCreatorTimePicker = useCallback(() => {
    setShowSubtaskTimePicker(false);
  }, []);

  const closeTaskEditorDatePicker = useCallback(() => {
    setShowTaskEditorDatePicker(false);
  }, []);

  const closeTaskEditorTimePicker = useCallback(() => {
    setShowTaskEditorTimePicker(false);
  }, []);

  const closeSubtaskEditorDatePicker = useCallback(() => {
    setShowSubtaskEditorDatePicker(false);
  }, []);

  const closeSubtaskEditorTimePicker = useCallback(() => {
    setShowSubtaskEditorTimePicker(false);
  }, []);

  const confirmTaskCreatorDatePicker = useCallback(() => {
    setSelectedDate((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    });
    closeTaskCreatorDatePicker();
  }, [closeTaskCreatorDatePicker]);

  const confirmTaskCreatorTimePicker = useCallback(() => {
    setSelectedTime((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setSeconds(0, 0);
      return fallback;
    });
    closeTaskCreatorTimePicker();
  }, [closeTaskCreatorTimePicker]);

  const confirmSubtaskCreatorDatePicker = useCallback(() => {
    setSubtaskDate((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    });
    closeSubtaskCreatorDatePicker();
  }, [closeSubtaskCreatorDatePicker]);

  const confirmSubtaskCreatorTimePicker = useCallback(() => {
    setSubtaskTime((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setSeconds(0, 0);
      return fallback;
    });
    closeSubtaskCreatorTimePicker();
  }, [closeSubtaskCreatorTimePicker]);

  const confirmTaskEditorDatePicker = useCallback(() => {
    setTaskEditorDate((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    });
    closeTaskEditorDatePicker();
  }, [closeTaskEditorDatePicker]);

  const confirmTaskEditorTimePicker = useCallback(() => {
    setTaskEditorTime((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setSeconds(0, 0);
      return fallback;
    });
    closeTaskEditorTimePicker();
  }, [closeTaskEditorTimePicker]);

  const confirmSubtaskEditorDatePicker = useCallback(() => {
    setSubtaskEditorDate((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    });
    closeSubtaskEditorDatePicker();
  }, [closeSubtaskEditorDatePicker]);

  const confirmSubtaskEditorTimePicker = useCallback(() => {
    setSubtaskEditorTime((current) => {
      if (current) return current;
      const fallback = new Date();
      fallback.setSeconds(0, 0);
      return fallback;
    });
    closeSubtaskEditorTimePicker();
  }, [closeSubtaskEditorTimePicker]);

  const iosPickerDoneLabel = language === "nl" ? "Gereed" : "Done";

  const renderIOSPicker = (
    visible: boolean,
    mode: "date" | "time",
    value: Date | null,
    onChange: (event: DateTimePickerEvent, date?: Date) => void,
    onConfirm: () => void,
    onCancel: () => void,
  ) => {
    if (!isIOS || !visible) return null;
    if (__DEV__) {
      console.log("[picker] renderIOSPicker", mode, visible);
    }
    return (
      <Modal
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        supportedOrientations={["portrait", "landscape"]}
        visible={visible}
        onRequestClose={onCancel}
      >
        <View style={iosPickerStyles.modalRoot}>
          <Pressable style={iosPickerStyles.backdrop} onPress={onCancel} />
          <View style={iosPickerStyles.sheetWrapper}>
            <View style={iosPickerStyles.sheet}>
              <DateTimePicker
                value={value ?? new Date()}
                mode={mode}
                display="spinner"
                onChange={onChange}
                style={iosPickerStyles.picker}
                textColor={colors.text}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={iosPickerDoneLabel}
                onPress={onConfirm}
                style={({ pressed }) => [
                  iosPickerStyles.doneButton,
                  pressed && iosPickerStyles.doneButtonPressed,
                ]}
              >
                <Text style={iosPickerStyles.doneButtonLabel}>
                  {iosPickerDoneLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const handleTaskCreatorTimeChange = (
    event: DateTimePickerEvent,
    time?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowTimePicker(false);
      return;
    }
    if (time) setSelectedTime(time);
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
  };

  const handleTaskCreatorDateChange = (
    event: DateTimePickerEvent,
    date?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    if (date) setSelectedDate(date);
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
  };

  const handleSubtaskCreatorDateChange = (
    event: DateTimePickerEvent,
    date?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowSubtaskDatePicker(false);
      return;
    }
    if (date) setSubtaskDate(date);
    if (Platform.OS === "android") {
      setShowSubtaskDatePicker(false);
    }
  };

  const handleSubtaskCreatorTimeChange = (
    event: DateTimePickerEvent,
    time?: Date,
  ) => {
    if (event.type === "dismissed") {
      setShowSubtaskTimePicker(false);
      return;
    }
    if (time) setSubtaskTime(time);
    if (Platform.OS === "android") {
      setShowSubtaskTimePicker(false);
    }
  };

  const taskCreatorIOSPicker = isIOS
    ? showDatePicker
      ? {
          mode: "date" as const,
          value: selectedDate,
          onChange: handleTaskCreatorDateChange,
          onConfirm: confirmTaskCreatorDatePicker,
          onCancel: closeTaskCreatorDatePicker,
        }
      : showTimePicker
        ? {
            mode: "time" as const,
            value: selectedTime,
            onChange: handleTaskCreatorTimeChange,
            onConfirm: confirmTaskCreatorTimePicker,
            onCancel: closeTaskCreatorTimePicker,
          }
        : null
    : null;

  const subtaskCreatorIOSPicker = isIOS
    ? showSubtaskDatePicker
      ? {
          mode: "date" as const,
          value: subtaskDate,
          onChange: handleSubtaskCreatorDateChange,
          onConfirm: confirmSubtaskCreatorDatePicker,
          onCancel: closeSubtaskCreatorDatePicker,
        }
      : showSubtaskTimePicker
        ? {
            mode: "time" as const,
            value: subtaskTime,
            onChange: handleSubtaskCreatorTimeChange,
            onConfirm: confirmSubtaskCreatorTimePicker,
            onCancel: closeSubtaskCreatorTimePicker,
          }
        : null
    : null;

  // Bereid de locatiemodal voor: seed met bestaande waarden en vraag permissies indien nodig.
  const openLocationPicker = useCallback(
    async (
      todoIndex?: number,
      source: ListSource = "active",
      subtaskIndex: number | null = null,
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
        typeof subtaskIndex === "number" ? subtaskIndex : null,
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
          setUserLocation(null);
          setLocationHelperMessage(
            language === "nl"
              ? "Locatieservices staan uit. Kies handmatig een locatie op de kaart."
              : "Location services are disabled. Select a location manually on the map.",
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
              const currentLatLng = {
                latitude: current.coords.latitude,
                longitude: current.coords.longitude,
              };
              setUserLocation(currentLatLng);
              if (!workingLocation) {
                workingLocation = { ...currentLatLng };
                workingRegion = {
                  latitude: workingLocation.latitude,
                  longitude: workingLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                };
              }
            } catch (err) {
              console.log("Kon huidige locatie niet ophalen:", err);
              setUserLocation(null);
              setLocationHelperMessage(
                language === "nl"
                  ? "Kon huidige locatie niet ophalen. Kies handmatig een locatie."
                  : "Unable to fetch current location. Please pick a spot manually.",
              );
            }
          } else {
            setUserLocation(null);
            setLocationHelperMessage(
              language === "nl"
                ? "Locatietoegang geweigerd. Kies handmatig een locatie op de kaart."
                : "Location access denied. Select a location manually on the map.",
            );
          }
        } else {
          setUserLocation(null);
          setLocationHelperMessage(
            language === "nl"
              ? "expo-location niet beschikbaar. Kies handmatig een locatie op de kaart."
              : "expo-location unavailable. Select a location manually on the map.",
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
              },
          );
        }
        setSelectedLocationDescription(seededDescription ?? null);
      } catch (err) {
        console.log("Locatie ophalen mislukt:", err);
        setUserLocation(null);
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
            : "Failed to fetch location.",
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
    ],
  );

  const handleTaskCreatorOpenLocation = useCallback(() => {
    if (taskCreatorTarget === "archive") {
      openLocationPicker(undefined, "archive");
    } else {
      openLocationPicker();
    }
  }, [openLocationPicker, taskCreatorTarget]);

  const handleSubtaskCreatorOpenLocation = useCallback(() => {
    if (subtaskCreatorParentIndex === null) {
      return;
    }
    openLocationPicker(
      subtaskCreatorParentIndex,
      subtaskCreatorSource,
      NEW_SUBTASK_LOCATION_INDEX,
    );
  }, [openLocationPicker, subtaskCreatorParentIndex, subtaskCreatorSource]);

  const handleSubtaskCreatorAdd = useCallback(() => {
    if (subtaskCreatorParentIndex === null) {
      return;
    }
    addSubtask(subtaskCreatorParentIndex, subtaskCreatorSource);
  }, [addSubtask, subtaskCreatorParentIndex, subtaskCreatorSource]);

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
          description ?? null,
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
            : prev,
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
    setMapRegion(
      userLocation
        ? {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        : DEFAULT_REGION,
    );
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
          : "Enter an address to search.",
      );
      return;
    }
    setLocationHelperMessage(null);
    setLocationLoading(true);
    try {
      if (Platform.OS === "web") {
        const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          query,
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
    [language, showInputWarning],
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
          },
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
              : "Enable notifications in settings to receive deadline alerts.",
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
                    err,
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
                  err,
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
                      err,
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
                    err,
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
  const taskCreatorDeadlinePreview =
    selectedDate || selectedTime
      ? combineDateAndTime(selectedDate, selectedTime)
      : null;
  const taskCreatorDeadlineDisplay = taskCreatorDeadlinePreview
    ? formatDate(taskCreatorDeadlinePreview)
    : "";
  const subtaskCreatorDeadlinePreview =
    subtaskDate || subtaskTime
      ? combineDateAndTime(subtaskDate, subtaskTime)
      : null;
  const subtaskCreatorDeadlineDisplay = subtaskCreatorDeadlinePreview
    ? formatDate(subtaskCreatorDeadlinePreview)
    : "";
  const taskCreatorLocationDisplay = selectedLocation
    ? getLocationDisplay(selectedLocation, selectedLocationDescription ?? null)
    : "";
  const subtaskCreatorLocationDisplay = newSubtaskLocation
    ? getLocationDisplay(
        newSubtaskLocation,
        newSubtaskLocationDescription ?? null,
      )
    : "";
  const editingTodoLocationDescription = editingTodo?.location
    ? getLocationDisplay(
        editingTodo.location,
        editingTodo.locationDescription ?? null,
      )
    : "";
  const editingSubtaskLocationDescription = editingSubtask?.location
    ? getLocationDisplay(
        editingSubtask.location,
        editingSubtask.locationDescription ?? null,
      )
    : "";
  const subtaskModalStrings = useMemo(
    () => ({
      editSubtask: strings.editSubtask,
      subtaskName: strings.subtaskName,
      deadline: strings.deadline,
      clearDeadline: strings.clearDeadline,
      noDeadline: strings.noDeadline,
      deadlineOverdue: strings.deadlineOverdue,
      addPhoto: strings.addPhoto,
      noPhoto: strings.noPhoto,
      pickFromGallery: strings.pickFromGallery,
      removePhoto: strings.removePhoto,
      locationLabel: strings.locationLabel,
      noLocationSelected: strings.noLocationSelected,
      updateLocation: strings.updateLocation,
      removeLocation: strings.removeLocation,
      priorityLabel: strings.priorityLabel,
      priorityHigh: strings.priorityHigh,
      priorityMedium: strings.priorityMedium,
      priorityLow: strings.priorityLow,
      cancel: strings.cancel,
      saveChanges: strings.saveChanges,
    }),
    [strings],
  );
  const taskModalStrings = useMemo(
    () => ({
      editTask: strings.editTask,
      taskName: strings.taskName,
      deadline: strings.deadline,
      clearDeadline: strings.clearDeadline,
      deadlineOverdue: strings.deadlineOverdue,
      noDeadline: strings.noDeadline,
      addPhoto: strings.addPhoto,
      noPhoto: strings.noPhoto,
      pickFromGallery: strings.pickFromGallery,
      removePhoto: strings.removePhoto,
      locationLabel: strings.locationLabel,
      noLocationSelected: strings.noLocationSelected,
      updateLocation: strings.updateLocation,
      removeLocation: strings.removeLocation,
      priorityLabel: strings.priorityLabel,
      priorityHigh: strings.priorityHigh,
      priorityMedium: strings.priorityMedium,
      priorityLow: strings.priorityLow,
      cancel: strings.cancel,
      saveChanges: strings.saveChanges,
    }),
    [strings],
  );
  const handleSubtaskEditorPickCamera = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null) {
      return;
    }
    pickImage(
      true,
      subtaskEditorParentIndex,
      subtaskEditorIndex,
      subtaskEditorSource === "archive",
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
      true,
    );
  };
  const handleSubtaskEditorUpdateLocation = () => {
    if (subtaskEditorParentIndex === null || subtaskEditorIndex === null) {
      return;
    }
    openLocationPicker(
      subtaskEditorParentIndex,
      subtaskEditorSource,
      subtaskEditorIndex,
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
      null,
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
      taskEditorSource === "archive",
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
      true,
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

  const handleTaskEditorSelectPriority = useCallback(
    (value: "low" | "medium" | "high") => {
      setTaskEditorPriority(value);
      setTaskEditorSnapshot((prev) =>
        prev ? { ...prev, priority: value } : prev,
      );
    },
    [],
  );

  if (!authReady || !userId) {
    return null;
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 120,
      }}
    >
      {Platform.OS === "web" && webToasts.length > 0 && (
        // Stapel toasts rechtsboven zodat meerdere meldingen zichtbaar blijven.
        <View pointerEvents="box-none" style={webToastStyles.host}>
          {webToasts.map((toast) => (
            <Pressable
              key={toast.id}
              onPress={() => removeToast(toast.id)}
              style={({ pressed }) => [
                webToastStyles.toast,
                webToastStyles[toast.tone],
                pressed && webToastStyles.toastPressed,
              ]}
            >
              <Text style={webToastStyles.toastTitle}>{toast.title}</Text>
              <Text style={webToastStyles.toastMessage}>{toast.message}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {Platform.OS === "web" && webConfirmDialog && (
        // Web gebruikt een custom modal zodat de rest van het scherm geblokkeerd blijft tijdens bevestigen.
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={handleWebConfirmCancel}
        >
          <View style={webConfirmStyles.overlay}>
            <Pressable
              onPress={handleWebConfirmCancel}
              style={webConfirmStyles.backdrop}
              accessibilityRole="button"
              accessibilityLabel={webConfirmDialog.cancelLabel}
            />
            <View style={webConfirmStyles.panel}>
              <Text style={webConfirmStyles.title}>
                {webConfirmDialog.title}
              </Text>
              <Text style={webConfirmStyles.message}>
                {webConfirmDialog.message}
              </Text>
              <View style={webConfirmStyles.actions}>
                <Pressable
                  onPress={handleWebConfirmCancel}
                  style={({ pressed }) => [
                    webConfirmStyles.button,
                    webConfirmStyles.secondaryButton,
                    pressed && webConfirmStyles.buttonPressed,
                  ]}
                >
                  <Text style={webConfirmStyles.secondaryLabel}>
                    {webConfirmDialog.cancelLabel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleWebConfirmConfirm}
                  style={({ pressed }) => [
                    webConfirmStyles.button,
                    webConfirmStyles.primaryButton,
                    pressed && webConfirmStyles.buttonPressed,
                  ]}
                >
                  <Text style={webConfirmStyles.primaryLabel}>
                    {webConfirmDialog.confirmLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
      {recentlyDeleted ? (
        <View
          pointerEvents="box-none"
          style={[
            restoreBannerStyles.container,
            {
              bottom: restoreBannerBottom,
              left: restoreBannerSides.left,
              right: restoreBannerSides.right,
            },
          ]}
        >
          <View style={restoreBannerStyles.panel}>
            <View style={restoreBannerStyles.textColumn}>
              <Text style={restoreBannerStyles.title}>
                {strings.restorePrompt}
              </Text>
              <Text style={restoreBannerStyles.subtitle} numberOfLines={2}>
                {recentlyDeleted.todo.text}
              </Text>
              <Text style={restoreBannerStyles.hint}>
                {strings.restoreHint}
              </Text>
            </View>
            <View style={restoreBannerStyles.actions}>
              <Pressable
                onPress={dismissRecentlyDeleted}
                style={({ pressed }) => [
                  restoreBannerStyles.secondaryButton,
                  pressed && restoreBannerStyles.buttonPressed,
                ]}
              >
                <Text style={restoreBannerStyles.secondaryLabel}>
                  {strings.cancel}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRestoreRecentlyDeleted}
                style={({ pressed }) => [
                  restoreBannerStyles.primaryButton,
                  pressed && restoreBannerStyles.buttonPressed,
                ]}
              >
                <Text style={restoreBannerStyles.primaryLabel}>
                  {strings.restore}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <ListHeaderControls
        colors={colors}
        showArchive={showArchive}
        language={language}
        theme={theme}
        sortOrder={sortOrder}
        prioritySort={prioritySort}
        tasksLabel={strings.tasks}
        archiveLabel={strings.archive}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
        onToggleSortOrder={toggleSortOrder}
        onTogglePrioritySort={togglePrioritySort}
        onSelectTab={(tab) => setShowArchive(tab === "archive")}
        onAddTask={handleHeaderAddTask}
        showAddButton={false}
        onLogout={logout}
        logoutLabel={strings.logout}
        currentDateLabel={selectedDayLabel}
        onGoToPreviousDay={goToPreviousDay}
        onGoToNextDay={goToNextDay}
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
        userLocation={userLocation}
        onMapPress={handleMapPress}
        onMarkerDragEnd={handleMarkerDragEnd}
      />
      <SubtaskEditorModal
        visible={subtaskEditorVisible}
        colors={colors}
        theme={theme}
        subtaskText={subtaskEditorText}
        onChangeText={setSubtaskEditorText}
        onOpenDate={openSubtaskEditorDate}
        onOpenTime={openSubtaskEditorTime}
        onClearDeadline={clearSubtaskEditorDeadline}
        deadlinePreview={subtaskEditorDeadlineDisplay}
        deadlineISO={
          subtaskEditorDeadlinePreview ?? editingSubtask?.deadline ?? null
        }
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
      <SubtaskCreatorModal
        visible={subtaskCreatorVisible}
        colors={colors}
        theme={theme}
        language={language}
        subtaskText={subtaskText}
        onChangeSubtask={setSubtaskText}
        priority={newSubtaskPriority}
        onSelectPriority={setNewSubtaskPriority}
        onOpenDate={openSubtaskDate}
        onOpenTime={openSubtaskTime}
        onOpenLocation={handleSubtaskCreatorOpenLocation}
        onAdd={handleSubtaskCreatorAdd}
        onClose={closeSubtaskCreator}
        placeholder={strings.newSubtask}
        deadlinePreview={subtaskCreatorDeadlineDisplay}
        locationPreview={subtaskCreatorLocationDisplay}
        locationAccessibility={{
          label:
            language === "nl"
              ? "Locatie voor subtaak instellen"
              : "Set subtask location",
          hint:
            language === "nl"
              ? "Open de kaart om een locatie voor deze subtaak te kiezen."
              : "Open the map to choose a location for this subtask.",
        }}
        iosPicker={subtaskCreatorIOSPicker}
      />
      <TaskEditorModal
        visible={taskEditorVisible}
        colors={colors}
        theme={theme}
        taskText={taskEditorText}
        onChangeText={setTaskEditorText}
        onOpenDate={openTaskEditorDate}
        onOpenTime={openTaskEditorTime}
        onClearDeadline={clearTaskEditorDeadline}
        deadlinePreview={taskEditorDeadlineDisplay}
        deadlineISO={editorDeadlinePreview ?? editingTodo?.deadline ?? null}
        showDatePicker={showTaskEditorDatePicker}
        showTimePicker={showTaskEditorTimePicker}
        dateValue={taskEditorDate}
        timeValue={taskEditorTime}
        priority={taskEditorPriority}
        onSelectPriority={handleTaskEditorSelectPriority}
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

      <TaskCreatorModal
        visible={taskCreatorVisible}
        colors={colors}
        theme={theme}
        language={language}
        taskText={task}
        onChangeTask={setTask}
        inputRef={taskInputRef}
        priority={newPriority}
        onSelectPriority={setNewPriority}
        onOpenDate={openTaskDate}
        onOpenTime={openTaskTime}
        onOpenLocation={handleTaskCreatorOpenLocation}
        onAdd={handleTaskCreatorAdd}
        placeholder={strings.addTask}
        deadlinePreview={taskCreatorDeadlineDisplay}
        locationPreview={taskCreatorLocationDisplay}
        locationAccessibility={{
          label: language === "nl" ? "Locatie instellen" : "Set location",
          hint:
            language === "nl"
              ? "Open de kaart om een locatie te kiezen."
              : "Open the map to choose a location.",
        }}
        onClose={closeTaskCreatorModal}
        iosPicker={taskCreatorIOSPicker}
      />

      {!taskCreatorIOSPicker &&
        renderIOSPicker(
          showDatePicker,
          "date",
          selectedDate,
          handleTaskCreatorDateChange,
          confirmTaskCreatorDatePicker,
          closeTaskCreatorDatePicker,
        )}
      {!taskCreatorIOSPicker &&
        renderIOSPicker(
          showTimePicker,
          "time",
          selectedTime,
          handleTaskCreatorTimeChange,
          confirmTaskCreatorTimePicker,
          closeTaskCreatorTimePicker,
        )}
      {!subtaskCreatorIOSPicker &&
        renderIOSPicker(
          showSubtaskDatePicker,
          "date",
          subtaskDate,
          handleSubtaskCreatorDateChange,
          confirmSubtaskCreatorDatePicker,
          closeSubtaskCreatorDatePicker,
        )}
      {!subtaskCreatorIOSPicker &&
        renderIOSPicker(
          showSubtaskTimePicker,
          "time",
          subtaskTime,
          handleSubtaskCreatorTimeChange,
          confirmSubtaskCreatorTimePicker,
          closeSubtaskCreatorTimePicker,
        )}
      {renderIOSPicker(
        showTaskEditorDatePicker,
        "date",
        taskEditorDate,
        handleTaskEditorDateChange,
        confirmTaskEditorDatePicker,
        closeTaskEditorDatePicker,
      )}
      {renderIOSPicker(
        showTaskEditorTimePicker,
        "time",
        taskEditorTime,
        handleTaskEditorTimeChange,
        confirmTaskEditorTimePicker,
        closeTaskEditorTimePicker,
      )}
      {renderIOSPicker(
        showSubtaskEditorDatePicker,
        "date",
        subtaskEditorDate,
        handleSubtaskEditorDateChange,
        confirmSubtaskEditorDatePicker,
        closeSubtaskEditorDatePicker,
      )}
      {renderIOSPicker(
        showSubtaskEditorTimePicker,
        "time",
        subtaskEditorTime,
        handleSubtaskEditorTimeChange,
        confirmSubtaskEditorTimePicker,
        closeSubtaskEditorTimePicker,
      )}

      {/* Als we het hoofd taken scherm tonen */}
      {!showArchive ? (
        <>
          {showTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={selectedTime || new Date()}
              mode="time"
              display="default"
              onChange={handleTaskCreatorTimeChange}
            />
          )}
          {/* Native datepicker */}
          {showDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              onChange={handleTaskCreatorDateChange}
            />
          )}

          {showSubtaskDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={subtaskDate || new Date()}
              mode="date"
              display="default"
              onChange={handleSubtaskCreatorDateChange}
            />
          )}

          {showSubtaskTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={subtaskTime || new Date()}
              mode="time"
              display="default"
              onChange={handleSubtaskCreatorTimeChange}
            />
          )}

          {/* Lijst met actieve taken (gesorteerd op priority + createdAt) */}
          <ActiveTodoList
            colors={colors}
            theme={theme}
            language={language}
            strings={strings}
            displayTodos={activeDisplayTodos}
            buildSubtaskDisplay={buildSubtaskDisplay}
            formatDate={formatDate}
            getLocationDisplay={getLocationDisplay}
            toggleTodo={toggleTodo}
            openLocationPicker={openLocationPicker}
            pickImage={pickImage}
            openTodoEditor={openTodoEditor}
            archiveTodo={archiveTodo}
            removeTodo={removeTodo}
            toggleSubtask={toggleSubtask}
            openSubtaskEditor={openSubtaskEditor}
            removeSubtask={removeSubtask}
            beginInlineSubtaskCreation={beginInlineSubtaskCreation}
            listRef={activeListRef}
          />
        </>
      ) : (
        <>
          {showTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={selectedTime || new Date()}
              mode="time"
              display="default"
              onChange={handleTaskCreatorTimeChange}
            />
          )}

          {showDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display="default"
              onChange={handleTaskCreatorDateChange}
            />
          )}

          {showSubtaskDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={subtaskDate || new Date()}
              mode="date"
              display="default"
              onChange={handleSubtaskCreatorDateChange}
            />
          )}

          {showSubtaskTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={subtaskTime || new Date()}
              mode="time"
              display="default"
              onChange={handleSubtaskCreatorTimeChange}
            />
          )}

          <ArchivedTodoList
            colors={colors}
            theme={theme}
            language={language}
            strings={strings}
            displayTodos={archivedDisplayTodos}
            buildSubtaskDisplay={buildSubtaskDisplay}
            formatDate={formatDate}
            getLocationDisplay={getLocationDisplay}
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
            beginInlineSubtaskCreation={beginInlineSubtaskCreation}
            listRef={archivedListRef}
          />
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addTaskButtonLabel}
        accessibilityHint={addTaskButtonHint}
        onPress={handleHeaderAddTask}
        hitSlop={6}
        style={({ pressed }) => [
          floatingAddStyles.fab,
          pressed && floatingAddStyles.fabPressed,
        ]}
      >
        <Ionicons
          name="add"
          size={22}
          color="#FFFFFF"
          style={floatingAddStyles.fabIcon}
        />
        <Text style={floatingAddStyles.fabLabel}>{addTaskButtonLabel}</Text>
      </Pressable>
    </View>
  );
};

const createWebConfirmStyles = (
  colors: ThemeColors,
  theme: "light" | "dark",
) => {
  // Deze stijlen bepalen de lichte/donkere uitstraling van de web confirm modal.
  const isLight = theme === "light";
  const primary = colors.deleteButton;
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    panel: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.formBackground,
      borderRadius: 24,
      paddingVertical: 22,
      paddingHorizontal: 24,
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.12 : 0.35,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
      elevation: 18,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
      marginBottom: 24,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    button: {
      minWidth: 120,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 12,
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.08 : 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    buttonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.97 }],
    },
    secondaryButton: {
      backgroundColor: colors.toggleButton,
    },
    primaryButton: {
      backgroundColor: primary,
    },
    secondaryLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: isLight ? "#20242B" : "#ECEFF6",
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
};

const createWebToastStyles = (colors: ThemeColors, theme: "light" | "dark") => {
  const palette: Record<WebToastTone, string> = {
    info: colors.addButton,
    success: theme === "light" ? "#32D74B" : "#30D158",
    warning: theme === "light" ? "#FF9F0A" : "#FFD60A",
    error: colors.deleteButton,
  };
  const baseBorder =
    theme === "light" ? "rgba(7, 18, 43, 0.08)" : "rgba(240, 245, 255, 0.16)";
  const shadowStrength = theme === "light" ? 0.18 : 0.35;

  return StyleSheet.create({
    host: {
      position: "absolute",
      top: 20,
      right: 20,
      left: 20,
      alignItems: "flex-end",
    },
    toast: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.formBackground,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: baseBorder,
      shadowOpacity: shadowStrength,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
      marginBottom: 12,
    },
    toastPressed: {
      opacity: 0.82,
    },
    toastTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 4,
    },
    toastMessage: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 18,
    },
    info: {
      borderColor: palette.info,
      shadowColor: palette.info,
    },
    success: {
      borderColor: palette.success,
      shadowColor: palette.success,
    },
    warning: {
      borderColor: palette.warning,
      shadowColor: palette.warning,
    },
    error: {
      borderColor: palette.error,
      shadowColor: palette.error,
    },
  });
};

const createRestoreBannerStyles = (
  colors: ThemeColors,
  theme: "light" | "dark",
) => {
  const accent = colors.addButton;
  const isLight = theme === "light";
  const isWeb = Platform.OS === "web";

  return StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 20,
    },
    panel: {
      width: "100%",
      maxWidth: 520,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.formBackground,
      flexDirection: isWeb ? "row" : "column",
      alignItems: isWeb ? "center" : "flex-start",
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.18 : 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    textColumn: {
      flex: 1,
      marginRight: isWeb ? 16 : 0,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    hint: {
      marginTop: 4,
      fontSize: 13,
      color: colors.placeholder,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: isWeb ? 0 : 16,
      flexWrap: "wrap",
      justifyContent: isWeb ? "flex-end" : "flex-start",
    },
    primaryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: accent,
      shadowColor: accent,
      shadowOpacity: isLight ? 0.3 : 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      marginLeft: isWeb ? 12 : 0,
      marginTop: isWeb ? 0 : 12,
    },
    primaryLabel: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },
    secondaryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: isLight ? "#E6ECF7" : "#1F2734",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      marginRight: isWeb ? 12 : 0,
    },
    secondaryLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    buttonPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.97 }],
    },
  });
};

const createIOSPickerStyles = (
  colors: ThemeColors,
  theme: "light" | "dark",
) => {
  const isLight = theme === "light";

  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheetWrapper: {
      padding: 16,
      width: "100%",
      alignItems: "center",
    },
    sheet: {
      width: "100%",
      maxWidth: 540,
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
    doneButton: {
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
    doneButtonPressed: {
      opacity: 0.85,
    },
    doneButtonLabel: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "600",
    },
  });
};

const createFloatingAddButtonStyles = (
  colors: ThemeColors,
  theme: "light" | "dark",
) => {
  const accent = colors.addButton;
  const isLight = theme === "light";

  return StyleSheet.create({
    fab: {
      position: "absolute",
      bottom: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 26,
      backgroundColor: accent,
      shadowColor: accent,
      shadowOpacity: isLight ? 0.25 : 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
      minWidth: 220,
      maxWidth: 320,
    },
    fabPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    fabIcon: {
      marginRight: 8,
    },
    fabLabel: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
  });
};

export default List;
