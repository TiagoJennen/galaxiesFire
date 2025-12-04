import { Platform } from "react-native";

let mapLibreModule: typeof import("@maplibre/maplibre-react-native") | null =
  null;

if (Platform.OS !== "web") {
  // Require alleen op native platforms zodat web bundels niet crashen.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  mapLibreModule = require("@maplibre/maplibre-react-native");
}

export const MapLibreGL:
  | (typeof import("@maplibre/maplibre-react-native"))["default"]
  | null = mapLibreModule?.default ?? null;

export const Logger = mapLibreModule?.Logger ?? {
  setLogCallback: () => false,
};

export const isMapLibreAvailable = mapLibreModule !== null;
