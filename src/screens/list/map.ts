import { Region } from "react-native-maps";
import type { LatLng } from "./types";

type MaybeEvent = {
  geometry?: { coordinates?: unknown };
  nativeEvent?: { geometry?: { coordinates?: unknown } };
  features?: Array<{ geometry?: { coordinates?: unknown } }>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const DEFAULT_REGION: Region = {
  latitude: 52.3702,
  longitude: 4.8952,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const MAPLIBRE_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";
export const DEFAULT_CAMERA_ZOOM = 12;
export const SELECTED_CAMERA_ZOOM = 14;

export const regionToZoomLevel = (region?: Region | null) => {
  if (!region || !region.latitudeDelta) return null;
  const zoomApprox = Math.log2(360 / region.latitudeDelta);
  return clamp(zoomApprox, 3, 18);
};

export const extractLonLatFromEvent = (event: MaybeEvent): LatLng | null => {
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
