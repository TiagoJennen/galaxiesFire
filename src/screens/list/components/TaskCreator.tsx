import React from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import type { ThemeColors } from "../theme";

export type TaskPriority = "low" | "medium" | "high";

type TaskCreatorProps = {
  colors: ThemeColors;
  taskText: string;
  onChangeTask: (value: string) => void;
  priority: TaskPriority;
  onSelectPriority: (value: TaskPriority) => void;
  onOpenDate: () => void;
  onOpenTime: () => void;
  onOpenLocation: () => void;
  onAdd: () => void;
  placeholder: string;
  locationAccessibility: {
    label: string;
    hint: string;
  };
};

const PRIORITY_BUTTONS: Array<{
  label: string;
  value: TaskPriority;
  activeColor: string;
}> = [
  { label: "H", value: "high", activeColor: "#ff6b6b" },
  { label: "M", value: "medium", activeColor: "#ffb366" },
  { label: "L", value: "low", activeColor: "#6bc66b" },
];

const TaskCreator: React.FC<TaskCreatorProps> = ({
  colors,
  taskText,
  onChangeTask,
  priority,
  onSelectPriority,
  onOpenDate,
  onOpenTime,
  onOpenLocation,
  onAdd,
  placeholder,
  locationAccessibility,
}) => (
  <View
    style={{
      flexDirection: "row",
      marginBottom: 20,
      alignItems: "center",
    }}
  >
    <TextInput
      placeholder={placeholder}
      value={taskText}
      onChangeText={onChangeTask}
      style={{
        flex: 1,
        padding: 10,
        backgroundColor: colors.formBackground,
        color: colors.text,
        borderRadius: 8,
      }}
      placeholderTextColor={colors.placeholder}
    />

    <View style={{ flexDirection: "row", marginLeft: 8 }}>
      {PRIORITY_BUTTONS.map((button, index) => (
        <TouchableOpacity
          key={button.value}
          onPress={() => onSelectPriority(button.value)}
          style={{
            padding: 8,
            borderRadius: 8,
            backgroundColor:
              priority === button.value ? button.activeColor : "#444",
            marginRight: index < PRIORITY_BUTTONS.length - 1 ? 4 : 0,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {button.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <TouchableOpacity
      onPress={onOpenDate}
      style={{
        marginLeft: 5,
        padding: 10,
        backgroundColor: "#6c757d",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>📅</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={onOpenTime}
      style={{
        marginLeft: 5,
        padding: 10,
        backgroundColor: "#6c757d",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>⏰</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={onOpenLocation}
      accessibilityLabel={locationAccessibility.label}
      accessibilityHint={locationAccessibility.hint}
      style={{
        marginLeft: 5,
        padding: 10,
        backgroundColor: "#6c757d",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>📍</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={onAdd}
      style={{
        marginLeft: 5,
        padding: 10,
        backgroundColor: colors.addButton,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff" }}>+</Text>
    </TouchableOpacity>
  </View>
);

export default TaskCreator;
