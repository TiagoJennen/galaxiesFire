import { Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

// Naam van de achtergrondtaak waarmee Expo de geofence updates afvuurt.
// Expo gebruikt deze identifier om de juiste callback terug te vinden; wijzigen verbreekt de koppeling.
export const GEOFENCE_TASK_NAME = "galaxiesfire-geo-task";
// Radius (meter) waarin we de gebruiker als "dichtbij" beschouwen.
// Met 100 m beperken we valse positives maar blijft de melding op tijd binnen.
const NOTIFICATION_RADIUS_METERS = 100;

// Structuur van een opgeslagen geofence doelpunt: zo weten we welke taak bij welke coördinaten hoort.
type GeofenceTarget = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
};

// Voorkom key-conflicten door alles per gebruiker te namespacen; meerdere accounts delen hetzelfde device.
const targetKey = (userId: string) => `geofence_targets_${userId}`;
const notifiedKey = (userId: string) => `geofence_notified_${userId}`;

const isWeb = Platform.OS === "web";
const isNative = Platform.OS === "ios" || Platform.OS === "android";

let webLocationSubscription: Location.LocationSubscription | null = null;
let webTargets: GeofenceTarget[] = [];
let webActiveUserId: string | null = null;
let webProcessingUpdate = false;
let webNotified = new Set<string>();
let webNotifiedLoadedFor: string | null = null;

const supportsBrowserNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

const requestBrowserNotificationPermission = async (): Promise<boolean> => {
  if (!supportsBrowserNotifications()) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch (error) {
    console.log("Browser notification permission error:", error);
    return false;
  }
};

const storeWebNotified = async () => {
  if (!webActiveUserId) {
    return;
  }
  try {
    await AsyncStorage.setItem(
      notifiedKey(webActiveUserId),
      JSON.stringify(Array.from(webNotified))
    );
  } catch (error) {
    console.log("Failed to persist web notified cache:", error);
  }
};

const loadWebNotified = async (userId: string) => {
  if (webNotifiedLoadedFor === userId) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(notifiedKey(userId));
    if (!raw) {
      webNotified = new Set();
    } else {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        webNotified = new Set(
          parsed.filter((value) => typeof value === "string")
        );
      } else {
        webNotified = new Set();
      }
    }
  } catch (error) {
    console.log("Failed to read web notified cache:", error);
    webNotified = new Set();
  }
  webNotifiedLoadedFor = userId;
};

const pruneWebNotified = () => {
  if (!webActiveUserId || !webTargets.length || !webNotified.size) {
    return;
  }
  let changed = false;
  webNotified.forEach((id) => {
    if (!webTargets.some((target) => target.id === id)) {
      webNotified.delete(id);
      changed = true;
    }
  });
  if (changed) {
    storeWebNotified().catch((error) =>
      console.log("Failed to prune web notified cache:", error)
    );
  }
};

const sendWebNotification = async (
  title: string,
  body: string
): Promise<boolean> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
    return true;
  } catch (expoError) {
    if (
      supportsBrowserNotifications() &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(title, { body });
        return true;
      } catch (browserError) {
        console.log("Browser notification error:", browserError);
      }
    }
    console.log("Failed to schedule web notification:", expoError);
    return false;
  }
};

// Bereken afstand in meters tussen twee coordinaten (haversine formule); nodig om de "binnen bereik"-check te doen.
const haversineDistance = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const EARTH_RADIUS = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
};

const handleWebLocationUpdate = async (location: Location.LocationObject) => {
  if (!webActiveUserId || webTargets.length === 0) {
    return;
  }
  if (webProcessingUpdate) {
    return;
  }
  webProcessingUpdate = true;
  try {
    const current = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    let changed = false;
    for (const target of webTargets) {
      if (webNotified.has(target.id)) {
        continue;
      }
      const distance = haversineDistance(current, target);
      if (distance <= NOTIFICATION_RADIUS_METERS) {
        const delivered = await sendWebNotification(
          "Task nearby",
          `You are close to "${target.title}".`
        );
        if (delivered) {
          webNotified.add(target.id);
          changed = true;
        }
      }
    }
    if (changed) {
      await storeWebNotified();
    }
  } finally {
    webProcessingUpdate = false;
  }
};

// Vraag benodigde foreground en background rechten op voordat we starten.
// Zonder deze rechten weigert Android de foreground service en vallen geofences stil.
const ensureGeoPermissions = async (): Promise<boolean> => {
  if (isWeb) {
    try {
      let status = (await Location.getForegroundPermissionsAsync()).status;
      if (status !== "granted") {
        status = (await Location.requestForegroundPermissionsAsync()).status;
      }
      if (status !== "granted") {
        return false;
      }
    } catch (error) {
      console.log("Web location permission error:", error);
      return false;
    }
    return true;
  }

  if (!isNative) {
    return false;
  }

  try {
    let foregroundStatus = (await Location.getForegroundPermissionsAsync())
      .status;
    if (foregroundStatus !== "granted") {
      foregroundStatus = (await Location.requestForegroundPermissionsAsync())
        .status;
    }
    if (foregroundStatus !== "granted") {
      return false;
    }
    const getBackground = Location.getBackgroundPermissionsAsync;
    const requestBackground = Location.requestBackgroundPermissionsAsync;
    if (getBackground && requestBackground) {
      let backgroundStatus = (await getBackground()).status;
      if (backgroundStatus !== "granted") {
        backgroundStatus = (await requestBackground()).status;
      }
      if (backgroundStatus !== "granted") {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.log("Native location permission error:", error);
    return false;
  }
};

const startWebLocationWatcher = async () => {
  if (!isWeb || !webTargets.length) {
    return;
  }
  const locationGranted = await ensureGeoPermissions();
  if (!locationGranted) {
    return;
  }
  const notificationsGranted = await requestBrowserNotificationPermission();
  if (!notificationsGranted) {
    return;
  }
  if (webLocationSubscription) {
    return;
  }
  try {
    webLocationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 120000,
        distanceInterval: 50,
      },
      (update) => {
        handleWebLocationUpdate(update).catch((error) =>
          console.log("Web geofence update error:", error)
        );
      }
    );
  } catch (error) {
    console.log("Failed to start web geofence watcher:", error);
  }
};

const stopWebLocationWatcher = async () => {
  if (webLocationSubscription) {
    webLocationSubscription.remove();
    webLocationSubscription = null;
  }
};

// Registreer de achtergrondjob eenmalig zodat Expo hem kan aanroepen.
// Dit gebeurt alleen op native platforms; web gebruikt een aparte watcher.
if (isNative && !TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask(
    GEOFENCE_TASK_NAME,
    async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
      if (error) {
        console.log("Geofence task error:", error);
        return;
      }
      // Neem het meest recente location sample uit de payload; oudere samples zijn minder relevant voor geofences.
      const location = (data as { locations?: Location.LocationObject[] })
        ?.locations?.[0];
      if (!location) return;

      // Haal de huidige gebruiker op zodat we de juiste targets gebruiken; anonieme gebruikers slaan niets op.
      const userId = await AsyncStorage.getItem("current_user_id");
      if (!userId) return;

      const rawTargets = await AsyncStorage.getItem(targetKey(userId));
      if (!rawTargets) return;

      // Targets leven als JSON in AsyncStorage; parseer voorzichtig zodat corrupte data de task niet laat crashen.
      let targets: GeofenceTarget[] = [];
      try {
        targets = JSON.parse(rawTargets);
      } catch {
        return;
      }
      if (!targets.length) return;

      const current = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Houd bij welke targets al een melding hebben verstuurd, zodat we niet bij elke update opnieuw pingen.
      const notified = new Set<string>(
        JSON.parse((await AsyncStorage.getItem(notifiedKey(userId))) ?? "[]")
      );
      let changed = false;

      for (const target of targets) {
        if (notified.has(target.id)) continue;
        const distance = haversineDistance(current, target);
        if (distance <= NOTIFICATION_RADIUS_METERS) {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Task nearby",
                body: `You are close to "${target.title}".`,
              },
              trigger: null,
            });
            // Noteer dat deze target al geactiveerd is, zodat we pas opnieuw melden als we het geheugen leegmaken.
            notified.add(target.id);
            changed = true;
          } catch (notifyError) {
            console.log("Geofence notification error:", notifyError);
          }
        }
      }

      if (changed) {
        await AsyncStorage.setItem(
          notifiedKey(userId),
          JSON.stringify(Array.from(notified))
        );
      }
    }
  );
}

const ensureLocationUpdates = async () => {
  if (!isNative) return;
  const granted = await ensureGeoPermissions();
  if (!granted) {
    return;
  }
  // Start de dienst alleen als hij nog niet draait.
  const hasStarted =
    await Location.hasStartedLocationUpdatesAsync(GEOFENCE_TASK_NAME);
  if (!hasStarted) {
    try {
      // Balanced accuracy houdt accu verbruik laag maar blijft bruikbaar.
      // Interval van 2 minuten/50 meter beperkt batterij-impact maar levert nog genoeg events.
      await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 120000,
        distanceInterval: 50,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "GalaxyFire location tracking",
          notificationBody: "Monitoring nearby tasks.",
        },
      });
    } catch (startError) {
      console.log("Failed to start geofence updates:", startError);
    }
  }
};

const stopLocationUpdates = async () => {
  if (!isNative) return;
  // Stop alleen wanneer de dienst effectief actief is.
  const hasStarted =
    await Location.hasStartedLocationUpdatesAsync(GEOFENCE_TASK_NAME);
  if (hasStarted) {
    try {
      await Location.stopLocationUpdatesAsync(GEOFENCE_TASK_NAME);
    } catch (stopError) {
      console.log("Failed to stop geofence updates:", stopError);
    }
  }
};

export const initializeGeofenceTask = async () => {
  if (isWeb) {
    try {
      const activeUser = await AsyncStorage.getItem("current_user_id");
      if (!activeUser) {
        await stopWebLocationWatcher();
        webTargets = [];
        webActiveUserId = null;
        webNotified = new Set();
        webNotifiedLoadedFor = null;
        return;
      }
      webActiveUserId = activeUser;
      let parsedTargets: GeofenceTarget[] = [];
      const storedTargets = await AsyncStorage.getItem(targetKey(activeUser));
      if (storedTargets) {
        try {
          const raw = JSON.parse(storedTargets);
          if (Array.isArray(raw)) {
            parsedTargets = raw.filter(
              (entry) =>
                entry &&
                typeof entry.id === "string" &&
                typeof entry.title === "string" &&
                typeof entry.latitude === "number" &&
                typeof entry.longitude === "number"
            ) as GeofenceTarget[];
          }
        } catch (error) {
          console.log("Failed to parse stored web targets:", error);
        }
      }
      webTargets = parsedTargets;
      webNotifiedLoadedFor = null;
      await loadWebNotified(activeUser);
      pruneWebNotified();
      if (webTargets.length > 0) {
        await startWebLocationWatcher();
      } else {
        await stopWebLocationWatcher();
      }
    } catch (error) {
      console.log("Failed to initialize web geofence state:", error);
    }
    return;
  }
  await ensureLocationUpdates();
};

export const syncGeofenceTargets = async (
  userId: string,
  targets: GeofenceTarget[]
) => {
  if (isWeb) {
    try {
      await AsyncStorage.setItem(targetKey(userId), JSON.stringify(targets));
    } catch (error) {
      console.log("Failed to persist web geofence targets:", error);
    }
    webActiveUserId = userId;
    webNotifiedLoadedFor = null;
    await loadWebNotified(userId);
    webTargets = targets;
    pruneWebNotified();
    if (!targets.length) {
      await stopWebLocationWatcher();
      webNotified = new Set();
      webNotifiedLoadedFor = userId;
      try {
        await AsyncStorage.removeItem(notifiedKey(userId));
      } catch (error) {
        console.log("Failed to clear web notified cache:", error);
      }
      return;
    }
    await startWebLocationWatcher();
    return;
  }

  if (!isNative) return;

  await AsyncStorage.setItem(targetKey(userId), JSON.stringify(targets));
  if (targets.length === 0) {
    await AsyncStorage.removeItem(notifiedKey(userId));
    await stopLocationUpdates();
  } else {
    await ensureLocationUpdates();
  }
};

export const clearGeofenceTaskState = async (userId?: string) => {
  if (isWeb) {
    const activeUser =
      userId ?? (await AsyncStorage.getItem("current_user_id")) ?? undefined;
    if (activeUser) {
      await AsyncStorage.removeItem(targetKey(activeUser));
      await AsyncStorage.removeItem(notifiedKey(activeUser));
    }
    await stopWebLocationWatcher();
    webTargets = [];
    webActiveUserId = null;
    webNotified = new Set();
    webNotifiedLoadedFor = null;
    return;
  }

  if (!isNative) return;

  const activeUser =
    userId ?? (await AsyncStorage.getItem("current_user_id")) ?? undefined;
  if (activeUser) {
    await AsyncStorage.removeItem(targetKey(activeUser));
    await AsyncStorage.removeItem(notifiedKey(activeUser));
  }
  await stopLocationUpdates();
};
