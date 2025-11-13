import { Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export const GEOFENCE_TASK_NAME = "galaxiesfire-geo-task";
const NOTIFICATION_RADIUS_METERS = 100;

type GeofenceTarget = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
};

const targetKey = (userId: string) => `geofence_targets_${userId}`;
const notifiedKey = (userId: string) => `geofence_notified_${userId}`;

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

const ensureGeoPermissions = async () => {
  if (Platform.OS === "web") return;
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    const requestedForeground =
      await Location.requestForegroundPermissionsAsync();
    if (requestedForeground.status !== "granted") {
      throw new Error("Foreground location permission not granted");
    }
  }
  const getBackground = Location.getBackgroundPermissionsAsync;
  const requestBackground = Location.requestBackgroundPermissionsAsync;
  if (getBackground && requestBackground) {
    const background = await getBackground();
    if (background.status !== "granted") {
      const requestedBackground = await requestBackground();
      if (requestedBackground.status !== "granted") {
        throw new Error("Background location permission not granted");
      }
    }
  }
};

if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask(
    GEOFENCE_TASK_NAME,
    async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
      if (error) {
        console.log("Geofence task error:", error);
        return;
      }
      const location = (data as { locations?: Location.LocationObject[] })
        ?.locations?.[0];
      if (!location || Platform.OS === "web") return;

      const userId = await AsyncStorage.getItem("current_user_id");
      if (!userId) return;

      const rawTargets = await AsyncStorage.getItem(targetKey(userId));
      if (!rawTargets) return;

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
  if (Platform.OS === "web") return;
  try {
    await ensureGeoPermissions();
  } catch (permissionError) {
    console.log("Geofence permission error:", permissionError);
    return;
  }
  const hasStarted =
    await Location.hasStartedLocationUpdatesAsync(GEOFENCE_TASK_NAME);
  if (!hasStarted) {
    try {
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
  if (Platform.OS === "web") return;
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
  if (Platform.OS === "web") return;
  await ensureLocationUpdates();
};

export const syncGeofenceTargets = async (
  userId: string,
  targets: GeofenceTarget[]
) => {
  if (Platform.OS === "web") return;
  await AsyncStorage.setItem(targetKey(userId), JSON.stringify(targets));
  if (targets.length === 0) {
    await AsyncStorage.removeItem(notifiedKey(userId));
    await stopLocationUpdates();
  } else {
    await ensureLocationUpdates();
  }
};

export const clearGeofenceTaskState = async (userId?: string) => {
  if (Platform.OS === "web") return;
  const activeUser =
    userId ?? (await AsyncStorage.getItem("current_user_id")) ?? undefined;
  if (activeUser) {
    await AsyncStorage.removeItem(targetKey(activeUser));
    await AsyncStorage.removeItem(notifiedKey(activeUser));
  }
  await stopLocationUpdates();
};
