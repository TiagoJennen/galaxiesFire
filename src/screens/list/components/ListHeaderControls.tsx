// Header met taal/thema toggles, sortering en tab-switch voor de lijst.
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeColors } from "../theme";

type ListHeaderControlsProps = {
  colors: ThemeColors;
  showArchive: boolean;
  language: "nl" | "en";
  theme: "light" | "dark";
  sortOrder: "oldest" | "newest";
  prioritySort: "highToLow" | "lowToHigh" | null;
  title?: string;
  subtitle?: string;
  tasksLabel: string;
  archiveLabel: string;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onToggleSortOrder: () => void;
  onTogglePrioritySort: () => void;
  onSelectTab: (tab: "tasks" | "archive") => void;
  onAddTask: () => void;
  showAddButton?: boolean;
  onLogout?: () => void;
  logoutLabel?: string;
  currentDateLabel: string;
  onGoToPreviousDay: () => void;
  onGoToNextDay: () => void;
  isLandscape?: boolean;
};

// Hoofdscherm-header met taal-, thema-, sorteer- en navigatieknoppen.
const ListHeaderControls: React.FC<ListHeaderControlsProps> = ({
  colors,
  showArchive,
  language,
  theme,
  sortOrder,
  prioritySort,
  title,
  subtitle,
  tasksLabel,
  archiveLabel,
  onToggleLanguage,
  onToggleTheme,
  onToggleSortOrder,
  onTogglePrioritySort,
  onSelectTab,
  onAddTask,
  showAddButton = true,
  onLogout,
  logoutLabel,
  currentDateLabel,
  onGoToPreviousDay,
  onGoToNextDay,
  isLandscape = false,
}) => {
  const styles = useMemo(
    () => createStyles({ colors, theme, isLandscape }),
    [colors, theme, isLandscape],
  );
  const isWeb = Platform.OS === "web";
  const accent = colors.addButton;
  const logoutAccent = colors.logoutButton;
  const isArchive = showArchive;
  const hasTitle = !!title && title.trim().length > 0;
  const hasSubtitle = !!subtitle && subtitle.trim().length > 0;
  const hasHeading = hasTitle || hasSubtitle;
  const showLogout = typeof onLogout === "function";

  const addTaskLabel = language === "nl" ? "Nieuwe taak" : "New task";
  const addTaskHint =
    language === "nl"
      ? "Open het formulier om een taak te maken."
      : "Open the form to create a task.";
  const previousDayLabel = language === "nl" ? "Vorige dag" : "Previous day";
  const previousDayHint =
    language === "nl"
      ? "Bekijk de taken van de vorige dag."
      : "Show tasks for the previous day.";
  const nextDayLabel = language === "nl" ? "Volgende dag" : "Next day";
  const nextDayHint =
    language === "nl"
      ? "Bekijk de taken van de volgende dag."
      : "Show tasks for the next day.";
  const logoutButtonLabel =
    logoutLabel ?? (language === "nl" ? "Uitloggen" : "Logout");
  const logoutButtonHint =
    language === "nl" ? "Log direct uit deze app." : "Sign out of the app.";
  const priorityIcon =
    prioritySort === "highToLow"
      ? "trending-down"
      : prioritySort === "lowToHigh"
        ? "trending-up"
        : "funnel-outline";
  const priorityLabel =
    language === "nl"
      ? prioritySort === null
        ? "Prioriteit sorteren uit"
        : prioritySort === "highToLow"
          ? "Prioriteit hoog naar laag"
          : "Prioriteit laag naar hoog"
      : prioritySort === null
        ? "Priority sorting off"
        : prioritySort === "highToLow"
          ? "Priority high to low"
          : "Priority low to high";
  const priorityHint =
    language === "nl"
      ? prioritySort === null
        ? "Tik om prioriteit hoog naar laag in te schakelen."
        : prioritySort === "highToLow"
          ? "Tik voor laag naar hoog."
          : "Tik om prioriteit sorteren uit te zetten."
      : prioritySort === null
        ? "Tap to sort high to low."
        : prioritySort === "highToLow"
          ? "Tap for low to high."
          : "Tap to disable priority sorting.";

  // Layout past zich aan wanneer er geen titel of ondertitel aanwezig is.
  const headingStyles = [
    styles.headingRow,
    !hasHeading && styles.headingRowNoTitle,
  ];
  const actionsColumnStyles = [
    styles.actionsColumn,
    !hasHeading && styles.actionsColumnCentered,
  ];
  const topControlRowStyles = [
    styles.topControlRow,
    !hasHeading && styles.topControlRowCentered,
  ];
  const controlRowStyles = [
    styles.controlRow,
    !hasHeading && styles.controlRowCentered,
  ];
  const dateSwitcherStyles = [
    styles.dateSwitcher,
    !hasHeading && styles.dateSwitcherCentered,
  ];

  // Kleine hulpplek voor icon/label knoppen, voorkomt dubbele opmaak in web en native.
  const ControlButton: React.FC<{
    label?: string;
    icon?: string;
    onPress: () => void;
    iconColor?: string;
    accessibilityLabel?: string;
    accessibilityHint?: string;
  }> = ({
    label,
    icon,
    onPress,
    iconColor,
    accessibilityLabel,
    accessibilityHint,
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        pressed && styles.controlButtonPressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon as any}
          size={16}
          color={iconColor ?? accent}
          style={label ? styles.controlIcon : styles.controlIconSolo}
        />
      ) : null}
      {label ? <Text style={styles.controlLabel}>{label}</Text> : null}
    </Pressable>
  );

  return (
    <View style={styles.wrapper}>
      {isWeb ? (
        <View style={topControlRowStyles}>
          <ControlButton
            label={language.toUpperCase()}
            onPress={onToggleLanguage}
          />
          <ControlButton
            icon={theme === "light" ? "moon" : "sunny"}
            onPress={onToggleTheme}
          />
          <ControlButton
            icon={sortOrder === "oldest" ? "arrow-down" : "arrow-up"}
            onPress={onToggleSortOrder}
          />
          <ControlButton
            icon={priorityIcon}
            onPress={onTogglePrioritySort}
            accessibilityLabel={priorityLabel}
            accessibilityHint={priorityHint}
          />
          {showLogout ? (
            <ControlButton
              icon="log-out-outline"
              iconColor={logoutAccent}
              onPress={onLogout!}
              accessibilityLabel={logoutButtonLabel}
              accessibilityHint={logoutButtonHint}
            />
          ) : null}
        </View>
      ) : null}

      <View style={headingStyles}>
        {hasHeading ? (
          <View style={styles.headingCopy}>
            {hasTitle ? <Text style={styles.title}>{title}</Text> : null}
            {hasSubtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={actionsColumnStyles}>
          {!isWeb ? (
            <View style={controlRowStyles}>
              <ControlButton
                label={language.toUpperCase()}
                onPress={onToggleLanguage}
              />
              <ControlButton
                icon={theme === "light" ? "moon" : "sunny"}
                onPress={onToggleTheme}
              />
              <ControlButton
                icon={sortOrder === "oldest" ? "arrow-down" : "arrow-up"}
                onPress={onToggleSortOrder}
              />
              <ControlButton
                icon={priorityIcon}
                onPress={onTogglePrioritySort}
                accessibilityLabel={priorityLabel}
                accessibilityHint={priorityHint}
              />
              {showLogout ? (
                <ControlButton
                  icon="log-out-outline"
                  iconColor={logoutAccent}
                  onPress={onLogout!}
                  accessibilityLabel={logoutButtonLabel}
                  accessibilityHint={logoutButtonHint}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={dateSwitcherStyles}>
        <View style={styles.dateArrowSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={previousDayLabel}
            accessibilityHint={previousDayHint}
            onPress={onGoToPreviousDay}
            hitSlop={6}
            style={({ pressed }) => [
              styles.dateSwitcherButton,
              pressed && styles.dateSwitcherButtonPressed,
            ]}
          >
            <Ionicons name="chevron-back" size={18} color={accent} />
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.dateLabelContainer}>
          <Text style={styles.dateLabel} numberOfLines={1} ellipsizeMode="clip">
            {currentDateLabel}
          </Text>
        </View>

        <View style={styles.dateArrowSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextDayLabel}
            accessibilityHint={nextDayHint}
            onPress={onGoToNextDay}
            hitSlop={6}
            style={({ pressed }) => [
              styles.dateSwitcherButton,
              pressed && styles.dateSwitcherButtonPressed,
            ]}
          >
            <Ionicons name="chevron-forward" size={18} color={accent} />
          </Pressable>
        </View>
      </View>

      <View style={styles.segmentedControl}>
        <Pressable
          onPress={() => onSelectTab("tasks")}
          style={({ pressed }) => [
            styles.segmentButton,
            !isArchive && styles.segmentButtonActive,
            pressed && styles.segmentButtonPressed,
          ]}
        >
          <Text
            style={!isArchive ? styles.segmentLabelActive : styles.segmentLabel}
          >
            {tasksLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onSelectTab("archive")}
          style={({ pressed }) => [
            styles.segmentButton,
            isArchive && styles.segmentButtonActive,
            pressed && styles.segmentButtonPressed,
          ]}
        >
          <Text
            style={isArchive ? styles.segmentLabelActive : styles.segmentLabel}
          >
            {archiveLabel}
          </Text>
        </Pressable>
      </View>

      {showAddButton ? (
        <View style={styles.bottomActionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addTaskLabel}
            accessibilityHint={addTaskHint}
            onPress={onAddTask}
            hitSlop={6}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonLabel}>{addTaskLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

export default ListHeaderControls;

const createStyles = ({
  colors,
  theme,
  isLandscape,
}: {
  colors: ThemeColors;
  theme: "light" | "dark";
  isLandscape: boolean;
}) => {
  const accent = colors.addButton;
  const logoutAccent = colors.logoutButton;
  const isLight = theme === "light";
  const isWeb = Platform.OS === "web";
  const titleFont = Platform.select({
    ios: "SFProDisplay-Bold",
    android: "sans-serif-medium",
    default: "System",
  });
  const bodyFont = Platform.select({
    ios: "SFProText-Regular",
    android: "sans-serif",
    default: "System",
  });

  return StyleSheet.create({
    wrapper: {
      marginBottom: isLandscape ? 2 : 12,
    },
    headingRow: {
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      marginTop: isLandscape ? 0 : -12,
    },
    headingRowNoTitle: {
      paddingTop: isLandscape ? 2 : 8,
    },
    headingCopy: {
      alignItems: "center",
      alignSelf: "center",
      marginBottom: isLandscape ? 10 : 6,
      paddingHorizontal: 8,
      width: "100%",
      maxWidth: 520,
    },
    title: {
      fontSize: 32,
      color: colors.text,
      fontFamily: titleFont,
      letterSpacing: 0.2,
      textAlign: "center",
    },
    subtitle: {
      marginTop: 6,
      fontSize: 15,
      color: isLight ? "#6E7686" : "#98A3B7",
      fontFamily: bodyFont,
      textAlign: "center",
    },
    actionsColumn: {
      width: "100%",
      maxWidth: 520,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: isLandscape ? 4 : 4,
      position: "relative",
    },
    actionsColumnCentered: {
      marginTop: isLandscape ? 0 : 2,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 20,
      backgroundColor: accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      shadowColor: accent,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
      minHeight: 44,
    },
    addButtonPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.96 }],
    },
    addButtonLabel: {
      marginLeft: 10,
      fontFamily: bodyFont,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.3,
      color: "#FFFFFF",
    },
    bottomActionRow: {
      marginTop: isWeb ? 14 : isLandscape ? 10 : 12,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      paddingHorizontal: 12,
    },
    topControlRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: isWeb ? "nowrap" : "wrap",
      marginBottom: isLandscape ? 6 : 10,
      alignSelf: "stretch",
    },
    topControlRowCentered: {
      justifyContent: "center",
    },
    controlRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      marginTop: isLandscape ? 2 : 8,
    },
    controlRowCentered: {
      justifyContent: "center",
      flexWrap: "wrap",
    },
    controlButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: isLandscape ? 8 : 10,
      backgroundColor: isLight ? "#FFFFFF" : "#1A202C",
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.08 : 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
      marginHorizontal: isLandscape ? 3 : 6,
      marginVertical: isLandscape ? 2 : 6,
    },
    controlButtonPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.85,
    },
    controlLabel: {
      fontFamily: bodyFont,
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.3,
      color: accent,
    },
    controlIcon: {
      marginRight: 6,
    },
    controlIconSolo: {
      marginRight: 0,
    },
    dateSwitcher: {
      marginTop: isWeb ? (isLandscape ? -8 : -8) : isLandscape ? 6 : 8,
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      minHeight: 44,
      paddingHorizontal: 12,
    },
    dateSwitcherCentered: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 520,
    },
    dateSwitcherButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isLight ? "#FFFFFF" : "#1A202C",
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.08 : 0.24,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    dateSwitcherButtonPressed: {
      transform: [{ scale: 0.95 }],
      opacity: 0.85,
    },
    dateArrowSlot: {
      width: 44,
      alignItems: "center",
      justifyContent: "center",
      marginTop: isWeb ? (isLandscape ? -4 : -8) : 0,
    },
    dateLabelContainer: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      flexDirection: "row",
      marginTop: isWeb ? (isLandscape ? -4 : -8) : 0,
    },
    dateLabel: {
      fontFamily: titleFont,
      fontSize: 18,
      color: colors.text,
      letterSpacing: 0.2,
      textAlign: "center",
      flexShrink: 1,
      maxWidth: "100%",
      minWidth: 0,
    },
    segmentedControl: {
      marginTop: isWeb ? 10 : isLandscape ? 6 : 10,
      flexDirection: "row",
      backgroundColor: isLight ? "#F0F2F8" : "#131B2B",
      borderRadius: 18,
      padding: 4,
      alignSelf: "center",
      maxWidth: isWeb ? 520 : undefined,
      width: isWeb ? "100%" : undefined,
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.08 : 0.24,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: isWeb ? 14 : isLandscape ? 8 : 10,
      paddingHorizontal: isWeb ? 16 : 8,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: isWeb ? 8 : 4,
    },
    segmentButtonActive: {
      backgroundColor: accent,
      shadowColor: accent,
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    segmentButtonPressed: {
      opacity: 0.85,
    },
    segmentLabel: {
      fontFamily: bodyFont,
      fontSize: isWeb ? 16 : 13,
      fontWeight: "600",
      color: isLight ? "#576176" : "#A1ABC2",
    },
    segmentLabelActive: {
      fontFamily: bodyFont,
      fontSize: isWeb ? 16 : 13,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
};
