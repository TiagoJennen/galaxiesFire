import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { ThemeColors } from "../theme";
import type { SubTodo, LatLng } from "../types";

type SubtaskStrings = {
  editSubtask: string;
  subtaskName: string;
  clearDeadline: string;
  noDeadline: string;
  addPhoto: string;
  noPhoto: string;
  pickFromGallery: string;
  removePhoto: string;
  locationLabel: string;
  noLocationSelected: string;
  updateLocation: string;
  removeLocation: string;
  cancel: string;
  saveChanges: string;
};

type SubtaskEditorModalProps = {
  visible: boolean;
  colors: ThemeColors;
  language: "nl" | "en";
  subtaskText: string;
  onChangeText: (text: string) => void;
  onOpenDate: () => void;
  onOpenTime: () => void;
  onClearDeadline: () => void;
  deadlinePreview: string;
  showDatePicker: boolean;
  showTimePicker: boolean;
  dateValue: Date | null;
  timeValue: Date | null;
  onChangeDate: (event: DateTimePickerEvent, date?: Date) => void;
  onChangeTime: (event: DateTimePickerEvent, date?: Date) => void;
  onClose: () => void;
  onSave: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onRemoveImage: () => void;
  editingSubtask: SubTodo | null;
  onUpdateLocation: () => void;
  onRemoveLocation: () => void;
  location: LatLng | null;
  locationDescription?: string;
  strings: SubtaskStrings;
};

const SubtaskEditorModal: React.FC<SubtaskEditorModalProps> = ({
  visible,
  colors,
  language,
  subtaskText,
  onChangeText,
  onOpenDate,
  onOpenTime,
  onClearDeadline,
  deadlinePreview,
  showDatePicker,
  showTimePicker,
  dateValue,
  timeValue,
  onChangeDate,
  onChangeTime,
  onClose,
  onSave,
  onPickCamera,
  onPickGallery,
  onRemoveImage,
  editingSubtask,
  onUpdateLocation,
  onRemoveLocation,
  location,
  locationDescription = "",
  strings,
}) => {
  if (!visible || !editingSubtask) {
    return null;
  }

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            margin: 20,
            backgroundColor: colors.formBackground,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            {strings.editSubtask}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 6,
            }}
          >
            {strings.subtaskName}
          </Text>
          <TextInput
            value={subtaskText}
            onChangeText={onChangeText}
            placeholder={strings.subtaskName}
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 10,
              color: colors.text,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              marginTop: 12,
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={onOpenDate}
              style={{
                padding: 10,
                backgroundColor: "#6c757d",
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>📅</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onOpenTime}
              style={{
                padding: 10,
                backgroundColor: "#6c757d",
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>⏰</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClearDeadline}>
              <Text style={{ color: colors.deleteButton }}>
                {strings.clearDeadline}
              </Text>
            </TouchableOpacity>
          </View>
          <Text
            style={{
              marginTop: 8,
              color: colors.text,
              fontSize: 14,
            }}
          >
            {deadlinePreview || strings.noDeadline}
          </Text>

          {showDatePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={dateValue ?? new Date()}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}

          {showTimePicker && Platform.OS !== "web" && (
            <DateTimePicker
              value={timeValue ?? new Date()}
              mode="time"
              display="default"
              onChange={onChangeTime}
            />
          )}

          <View style={{ marginTop: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 6,
              }}
            >
              {strings.addPhoto}
            </Text>
            {editingSubtask.image ? (
              <Image
                source={{ uri: editingSubtask.image }}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              />
            ) : (
              <Text style={{ color: colors.placeholder }}>
                {strings.noPhoto}
              </Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <TouchableOpacity
                onPress={onPickCamera}
                style={{ marginRight: 12, marginBottom: 8 }}
              >
                <Text style={{ color: colors.addButton }}>
                  📷 {strings.addPhoto}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onPickGallery}
                style={{ marginRight: 12, marginBottom: 8 }}
              >
                <Text style={{ color: colors.addButton }}>
                  🖼️ {strings.pickFromGallery}
                </Text>
              </TouchableOpacity>
              {editingSubtask.image && (
                <TouchableOpacity
                  onPress={onRemoveImage}
                  style={{ marginBottom: 8 }}
                >
                  <Text style={{ color: colors.deleteButton }}>
                    ✖ {strings.removePhoto}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
                marginBottom: 6,
              }}
            >
              {strings.locationLabel}
            </Text>
            {location ? (
              <Text style={{ color: colors.text, marginBottom: 8 }}>
                {locationDescription || strings.noLocationSelected}
              </Text>
            ) : (
              <Text style={{ color: colors.placeholder, marginBottom: 8 }}>
                {strings.noLocationSelected}
              </Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <TouchableOpacity
                onPress={onUpdateLocation}
                style={{ marginRight: 12, marginBottom: 8 }}
              >
                <Text style={{ color: colors.addButton }}>
                  📍 {strings.updateLocation}
                </Text>
              </TouchableOpacity>
              {location && (
                <TouchableOpacity
                  onPress={onRemoveLocation}
                  style={{ marginBottom: 8 }}
                >
                  <Text style={{ color: colors.deleteButton }}>
                    ✖ {strings.removeLocation}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 20,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: colors.toggleButton,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {strings.cancel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: colors.addButton,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {strings.saveChanges}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SubtaskEditorModal;
