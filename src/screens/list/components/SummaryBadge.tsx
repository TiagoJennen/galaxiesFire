// Badgecomponent die in modals een label met bijbehorende waarde toont (deadline en locatie)
import React from "react";
import { View, Text } from "react-native";
import type { ThemeColors } from "../theme";

export type SummaryBadgeProps = {
  label: string;
  value: string;
  isPlaceholder: boolean;
  colors: ThemeColors;
  theme: "light" | "dark";
};

// Kleine badge die deadline of locatie samenvat in modals.
const SummaryBadge: React.FC<SummaryBadgeProps> = ({
  label,
  value,
  isPlaceholder,
  colors,
  theme,
}) => {
  const isLight = theme === "light";

  return (
    <View
      style={{
        flex: 1,
        marginRight: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: isLight ? "#EEF3FF" : "#1A2233",
        borderWidth: 1,
        borderColor: isLight ? "#D8E2F5" : "#252F43",
      }}
    >
      {/* Label blijft altijd in de placeholderkleur zodat hij minder dominant is */}
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: colors.placeholder,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      {/* Waarde wisselt tussen placeholder- en tekstkleur afhankelijk of er data is */}
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: isPlaceholder ? colors.placeholder : colors.text,
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
};

export default SummaryBadge;
