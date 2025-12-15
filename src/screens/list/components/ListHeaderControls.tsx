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
  prioritySort: "highToLow" | "lowToHigh";
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
}) => {
  const styles = useMemo(
    () => createStyles({ colors, theme }),
    [colors, theme]
  );
  const isWeb = Platform.OS === "web";
  const accent = colors.addButton;
  const logoutAccent = colors.logoutButton;
  const isArchive = showArchive;
  const hasTitle = !!title && title.trim().length > 0;
  const hasSubtitle = !!subtitle && subtitle.trim().length > 0;
  const hasHeading = hasTitle || hasSubtitle;
  const showLogout = typeof onLogout === "function";

  const addTaskLabel =
    language === "nl" ? "Hoofdtaak toevoegen" : "Add main task";
  const addTaskHint =
    language === "nl"
      ? "Open het formulier om een hoofdtaak te maken."
      : "Open the form to create a main task.";
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
  const primaryButtonsRowStyles = [
    styles.primaryButtonsRow,
    !hasHeading && styles.primaryButtonsRowCentered,
    !showAddButton && styles.primaryButtonsRowNoAdd,
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
            icon={prioritySort === "highToLow" ? "funnel-outline" : "funnel"}
            onPress={onTogglePrioritySort}
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
          <View style={primaryButtonsRowStyles}>
            {showAddButton ? (
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
                <Text style={styles.addButtonLabel}>
                  {language === "nl" ? "Nieuwe hoofdtaak" : "New main task"}
                </Text>
              </Pressable>
            ) : null}
          </View>

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
                icon={
                  prioritySort === "highToLow" ? "funnel-outline" : "funnel"
                }
                onPress={onTogglePrioritySort}
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
    </View>
  );
};

export default ListHeaderControls;

const createStyles = ({
  colors,
  theme,
}: {
  colors: ThemeColors;
  theme: "light" | "dark";
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
      marginBottom: 28,
    },
    headingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    headingRowNoTitle: {
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 12,
    },
    headingCopy: {
      flex: 1,
      marginRight: 16,
    },
    title: {
      fontSize: 32,
      color: colors.text,
      fontFamily: titleFont,
      letterSpacing: 0.2,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 15,
      color: isLight ? "#6E7686" : "#98A3B7",
      fontFamily: bodyFont,
    },
    actionsColumn: {
      flex: 1,
      alignItems: "flex-end",
      justifyContent: "flex-start",
      position: "relative",
    },
    actionsColumnCentered: {
      alignItems: "center",
      alignSelf: "center",
      width: "100%",
      maxWidth: 520,
      marginTop: 20,
    },
    primaryButtonsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch",
      width: "100%",
      marginTop: 4,
      marginBottom: 12,
      flexWrap: "wrap",
      position: "relative",
    },
    primaryButtonsRowCentered: {
      justifyContent: "center",
    },
    primaryButtonsRowNoAdd: {
      justifyContent: "flex-end",
      marginTop: 0,
      marginBottom: 0,
      alignSelf: "stretch",
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
    topControlRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      flexWrap: isWeb ? "nowrap" : "wrap",
      marginBottom: 16,
      alignSelf: "stretch",
    },
    topControlRowCentered: {
      justifyContent: "center",
    },
    controlRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
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
      paddingVertical: 10,
      backgroundColor: isLight ? "#FFFFFF" : "#1A202C",
      shadowColor: "#000",
      shadowOpacity: isLight ? 0.08 : 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
      marginHorizontal: 6,
      marginVertical: 6,
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
      marginTop: isWeb ? 12 : 20,
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
    },
    dateLabelContainer: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      flexDirection: "row",
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
      marginTop: isWeb ? 16 : 20,
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
      paddingVertical: isWeb ? 14 : 10,
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
