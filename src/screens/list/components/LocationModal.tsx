// Kaartmodal om locaties te zoeken, slepen en bevestigen voor taken.
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MapLibreGL, isMapLibreAvailable } from "../../../utils/maplibre";
import type { ThemeColors } from "../theme";
import type { LatLng } from "../types";
import { translations } from "../../../constants/translations";

type WebMapProps = {
  mapStyleUrl: string;
  cameraCenter: [number, number];
  cameraZoom: number;
  activeMarker: LatLng | null;
  userLocation: LatLng | null;
  onMapPress: (event: any) => void;
  onMarkerDragEnd: (event: any) => void;
  colors: ThemeColors;
  language: "nl" | "en";
};

const ensureMapLibreCss = () => {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("maplibre-gl-css");
  if (existing) return;
  const link = document.createElement("link");
  link.id = "maplibre-gl-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/maplibre-gl@3.6.0/dist/maplibre-gl.css";
  document.head.appendChild(link);
};

const WebMapPreview: React.FC<WebMapProps> = ({
  mapStyleUrl,
  cameraCenter,
  cameraZoom,
  activeMarker,
  userLocation,
  onMapPress,
  onMarkerDragEnd,
  colors,
  language,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [mapLibre, setMapLibre] = useState<any>(null);

  useEffect(() => {
    ensureMapLibreCss();
    let cancelled = false;
    (async () => {
      try {
        const module = await import("maplibre-gl");
        const lib = (module as any).default ?? module;
        if (cancelled) return;
        setMapLibre(() => lib);
        if (!containerRef.current) return;
        const map = new lib.Map({
          container: containerRef.current,
          style: mapStyleUrl,
          center: cameraCenter,
          zoom: cameraZoom,
        });
        mapInstanceRef.current = map;
        map.on("click", (event: any) => {
          const { lng, lat } = event.lngLat;
          onMapPress({ geometry: { coordinates: [lng, lat] } });
        });
      } catch (error) {
        console.log("Failed to load maplibre-gl for web:", error);
      }
    })();
    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapStyleUrl, cameraCenter, cameraZoom, onMapPress]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.easeTo({
      center: cameraCenter,
      zoom: cameraZoom,
      duration: 500,
    });
  }, [cameraCenter, cameraZoom]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLibre) return;
    if (!activeMarker) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    const createMarkerElement = () => {
      const outer = document.createElement("div");
      outer.style.width = "28px";
      outer.style.height = "28px";
      outer.style.borderRadius = "14px";
      outer.style.backgroundColor = colors.addButton;
      outer.style.border = "3px solid #fff";
      outer.style.display = "flex";
      outer.style.alignItems = "center";
      outer.style.justifyContent = "center";
      outer.style.position = "relative";
      outer.style.boxShadow = "0 6px 12px rgba(0,0,0,0.25)";

      const inner = document.createElement("div");
      inner.style.width = "8px";
      inner.style.height = "8px";
      inner.style.borderRadius = "4px";
      inner.style.backgroundColor = "#fff";

      const pointer = document.createElement("div");
      pointer.style.position = "absolute";
      pointer.style.bottom = "-10px";
      pointer.style.left = "50%";
      pointer.style.transform = "translateX(-50%)";
      pointer.style.width = "0";
      pointer.style.height = "0";
      pointer.style.borderLeft = "7px solid transparent";
      pointer.style.borderRight = "7px solid transparent";
      pointer.style.borderTop = `10px solid ${colors.addButton}`;

      outer.appendChild(inner);
      outer.appendChild(pointer);
      return outer;
    };
    const target: [number, number] = [
      activeMarker.longitude,
      activeMarker.latitude,
    ];
    if (!markerRef.current) {
      markerRef.current = new mapLibre.Marker({
        draggable: true,
        element: createMarkerElement(),
        offset: [0, -14],
      })
        .setLngLat(target)
        .addTo(mapInstanceRef.current);
      markerRef.current.on("dragend", () => {
        const lngLat = markerRef.current.getLngLat();
        onMarkerDragEnd({
          geometry: { coordinates: [lngLat.lng, lngLat.lat] },
        });
      });
    } else {
      markerRef.current.setLngLat(target);
    }
  }, [activeMarker, mapLibre, onMarkerDragEnd, colors.addButton]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLibre) return;
    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }
    const createUserMarkerElement = () => {
      const outer = document.createElement("div");
      outer.style.width = "22px";
      outer.style.height = "22px";
      outer.style.borderRadius = "11px";
      outer.style.border = "2px solid #fff";
      outer.style.backgroundColor = "#2563eb";
      outer.style.boxShadow = "0 2px 4px rgba(37,99,235,0.4)";
      return outer;
    };
    const coords: [number, number] = [
      userLocation.longitude,
      userLocation.latitude,
    ];
    if (!userMarkerRef.current) {
      userMarkerRef.current = new mapLibre.Marker({
        element: createUserMarkerElement(),
        anchor: "center",
      })
        .setLngLat(coords)
        .addTo(mapInstanceRef.current);
    } else {
      userMarkerRef.current.setLngLat(coords);
    }
  }, [userLocation, mapLibre]);

  if (!mapLibre) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            color: colors.text,
            textAlign: "center",
            fontWeight: "500",
          }}
        >
          {language === "nl" ? "Kaart aan het laden..." : "Loading map..."}
        </Text>
      </View>
    );
  }

  return <div ref={containerRef} style={{ flex: 1 }} />;
};

// Props voor de LocationModal
type LocationModalProps = {
  visible: boolean;
  colors: ThemeColors;
  language: "nl" | "en";
  theme: "light" | "dark";
  helperMessage: string | null; // Eventuele waarschuwing of tip bovenaan
  onDismissHelper: () => void;
  searchText: string;
  onChangeSearchText: (text: string) => void;
  onSearch: () => void;
  loading: boolean;
  onClear: () => void;
  onConfirm: () => void;
  mapStyleUrl: string; // MapLibre stijl URL
  cameraCenter: [number, number];
  cameraZoom: number;
  activeMarker: LatLng | null; // Huidige locatie marker
  userLocation: LatLng | null;
  onMapPress: (event: any) => void;
  onMarkerDragEnd: (event: any) => void;
};

// Modal die platformafhankelijk MapLibre of een web fallback toont om locaties te kiezen.
const LocationModal: React.FC<LocationModalProps> = ({
  visible,
  colors,
  language,
  theme,
  helperMessage,
  onDismissHelper,
  searchText,
  onChangeSearchText,
  onSearch,
  loading,
  onClear,
  onConfirm,
  mapStyleUrl,
  cameraCenter,
  cameraZoom,
  activeMarker,
  userLocation,
  onMapPress,
  onMarkerDragEnd,
}) => {
  if (!visible) return null; // Render niet als modal niet zichtbaar

  const t = translations[language]; // Gebruik vertalingen

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onConfirm} // Android back knop
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
        }}
      >
        {/* Hoofdcontainer */}
        <View
          style={{
            margin: 20,
            backgroundColor: colors.formBackground,
            borderRadius: 12,
            overflow: "hidden",
            flex: 0.7,
            width: "90%",
            maxWidth: 720,
            alignSelf: "center",
          }}
        >
          {/* Helper message (bv. waarschuwing) */}
          {helperMessage && (
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
                {helperMessage}
              </Text>
              <TouchableOpacity
                onPress={onDismissHelper}
                style={{ paddingLeft: 12 }}
              >
                <Ionicons name="close" size={20} color={colors.warningText} />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flex: 1 }}>
            {/* Zoekbalk */}
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
                value={searchText}
                onChangeText={onChangeSearchText}
                placeholder={t.searchAddressPlaceholder}
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
                onSubmitEditing={onSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={onSearch}
                disabled={loading}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  backgroundColor: colors.addButton,
                  borderRadius: 8,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  {t.searchAddressButton}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Map */}
            {isMapLibreAvailable && MapLibreGL ? (
              <MapLibreGL.MapView
                style={{ flex: 1 }}
                mapStyle={mapStyleUrl}
                logoEnabled={false}
                compassEnabled
                onPress={onMapPress}
              >
                <MapLibreGL.Camera
                  centerCoordinate={cameraCenter}
                  zoomLevel={cameraZoom}
                  animationMode="easeTo"
                  animationDuration={500}
                />
                {userLocation && (
                  <MapLibreGL.PointAnnotation
                    id="user-location"
                    coordinate={[userLocation.longitude, userLocation.latitude]}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: "#fff",
                        backgroundColor: "#2563eb",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: "#fff",
                        }}
                      />
                    </View>
                  </MapLibreGL.PointAnnotation>
                )}
                {activeMarker && (
                  <MapLibreGL.PointAnnotation
                    id="selected-location"
                    coordinate={[activeMarker.longitude, activeMarker.latitude]}
                    draggable
                    onDragEnd={onMarkerDragEnd}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <View
                      style={{
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          borderWidth: 3,
                          borderColor: "#fff",
                          backgroundColor: colors.addButton,
                          justifyContent: "center",
                          alignItems: "center",
                          shadowColor: "#000",
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 6,
                        }}
                      >
                        <Ionicons
                          name="location-sharp"
                          size={18}
                          color="#fff"
                        />
                      </View>
                      <View
                        style={{
                          marginTop: -3,
                          width: 0,
                          height: 0,
                          borderLeftWidth: 7,
                          borderRightWidth: 7,
                          borderTopWidth: 8,
                          borderLeftColor: "transparent",
                          borderRightColor: "transparent",
                          borderTopColor: colors.addButton,
                          transform: [{ translateY: -1 }],
                        }}
                      />
                    </View>
                  </MapLibreGL.PointAnnotation>
                )}
              </MapLibreGL.MapView>
            ) : (
              <WebMapPreview
                mapStyleUrl={mapStyleUrl}
                cameraCenter={cameraCenter}
                cameraZoom={cameraZoom}
                activeMarker={activeMarker}
                userLocation={userLocation}
                onMapPress={onMapPress}
                onMarkerDragEnd={onMarkerDragEnd}
                colors={colors}
                language={language}
              />
            )}

            {/* Loading overlay */}
            {loading && (
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

          {/* Actieknoppen onderaan */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 12,
            }}
          >
            <TouchableOpacity onPress={onClear}>
              <Text style={{ color: colors.deleteButton, fontWeight: "600" }}>
                {language === "nl" ? "Verwijder" : "Clear"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm}>
              <Text style={{ color: colors.addButton, fontWeight: "600" }}>
                {language === "nl" ? "Bevestigen" : "Confirm"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LocationModal;
