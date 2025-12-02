import React from "react";
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
import MapLibreGL from "@maplibre/maplibre-react-native";
import type { ThemeColors } from "../theme";
import type { LatLng } from "../types";
import { translations } from "../../../constants/translations";

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
  onMapPress: (event: any) => void;
  onMarkerDragEnd: (event: any) => void;
};

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
              {activeMarker && (
                <MapLibreGL.PointAnnotation
                  id="selected-location"
                  coordinate={[activeMarker.longitude, activeMarker.latitude]}
                  draggable
                  onDragEnd={onMarkerDragEnd}
                />
              )}
            </MapLibreGL.MapView>

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
