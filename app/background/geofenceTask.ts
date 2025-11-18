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

// Vraag benodigde foreground en background rechten op voordat we starten.
// Zonder deze rechten weigert Android de foreground service en vallen geofences stil.
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

// Registreer de achtergrondjob eenmalig zodat Expo hem kan aanroepen.
// Dit gebeurt bij het importeren van het bestand; daarna kan het OS ons wakker maken zodra er locatie-updates zijn.
if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
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
      if (!location || Platform.OS === "web") return;

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
  if (Platform.OS === "web") return;
  try {
    await ensureGeoPermissions();
  } catch (permissionError) {
    console.log("Geofence permission error:", permissionError);
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
  if (Platform.OS === "web") return;
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
  if (Platform.OS === "web") return;
  // Aanroepen bij app start of login activeert de watcher zodat geofences meteen lopen.
  await ensureLocationUpdates();
};

export const syncGeofenceTargets = async (
  userId: string,
  targets: GeofenceTarget[]
) => {
  if (Platform.OS === "web") return;
  // Sla de nieuwste lijst doelen lokaal op voor de achtergrondjob.
  // De achtergrondtaak leest deze lijst binnen enkele seconden in en gebruikt hem bij de volgende location-update.
  await AsyncStorage.setItem(targetKey(userId), JSON.stringify(targets));
  if (targets.length === 0) {
    // Geen doelen meer: wis caches en zet de service uit zodat de gebruiker geen onnodige accu verbruikt.
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
    // Bij uitloggen opruimen zodat oude data geen meldingen meer triggert en privacy gewaarborgd blijft.
    await AsyncStorage.removeItem(targetKey(activeUser));
    await AsyncStorage.removeItem(notifiedKey(activeUser));
  }
  await stopLocationUpdates();
};
