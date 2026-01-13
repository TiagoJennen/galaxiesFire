import { Platform, NativeModules } from "react-native";

let mapLibreModule: typeof import("@maplibre/maplibre-react-native") | null =
  null;

const hasNativeMapLibre =
  Platform.OS !== "web" &&
  Boolean(
    NativeModules?.MLRNModule ||
      NativeModules?.MLRNSnapshotModule ||
      NativeModules?.MLRNLogging
  );

if (hasNativeMapLibre) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mapLibreModule = require("@maplibre/maplibre-react-native");
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "MapLibre native module ontbreekt; features worden in Expo Go uitgeschakeld.",
        error
      );
    }
    mapLibreModule = null;
  }
} else if (Platform.OS !== "web" && __DEV__) {
  console.warn(
    "MapLibre native module ontbreekt; features worden in Expo Go uitgeschakeld."
  );
}

export const MapLibreGL:
  | (typeof import("@maplibre/maplibre-react-native"))["default"]
  | null = mapLibreModule?.default ?? null;

export const Logger = mapLibreModule?.Logger ?? {
  setLogCallback: () => false,
};

export const isMapLibreAvailable = mapLibreModule !== null;
