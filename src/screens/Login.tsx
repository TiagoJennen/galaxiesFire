import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
  Pressable,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FIREBASE_AUTH } from "../services/FirebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { translations } from "../constants/translations";

interface Props {
  theme: "light" | "dark";
  toggleTheme: () => void;
  language: "nl" | "en";
  toggleLanguage: () => void;
}
const Login: React.FC<Props> = ({
  theme,
  toggleTheme,
  language,
  toggleLanguage,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get("window").width,
  );
  const [screenHeight, setScreenHeight] = useState(
    Dimensions.get("window").height,
  );
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    screenWidth < screenHeight ? "portrait" : "landscape",
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreenWidth(window.width);
      setScreenHeight(window.height);
      setOrientation(window.width < window.height ? "portrait" : "landscape");
    });

    return () => subscription?.remove();
  }, []);

  const signIn = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(FIREBASE_AUTH, email, password);
      navigation.reset({ index: 0, routes: [{ name: "Inside" }] });
    } catch (error: any) {
      const code = error?.code ?? "";
      const message = String(error?.message ?? "");
      const combinedErrorText = `${code} ${message}`.toLowerCase();
      const invalidCredentialCodes = [
        "auth/user-not-found",
        "auth/wrong-password",
        "auth/invalid-credential",
        "auth/invalid-login-credentials",
      ];
      if (invalidCredentialCodes.includes(code)) {
        alert(translations[language].invalidCredentials);
      } else if (code === "auth/network-request-failed") {
        const invalidConfig =
          combinedErrorText.includes("api key") ||
          combinedErrorText.includes("api_key_invalid") ||
          combinedErrorText.includes("api key not valid");
        alert(
          invalidConfig
            ? translations[language].firebaseConfigInvalid
            : translations[language].authNetworkFailed,
        );
      } else {
        console.log("Firebase login error:", { code, message, raw: error });
        alert(translations[language].loginFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  const navigation = useNavigation<any>();

  const accentColor = "#0A84FF";
  const containerBackground = theme === "light" ? "#F4F6FB" : "#040608";
  const subtitleText =
    language === "nl"
      ? "Welkom terug! Meld je aan."
      : "Welcome back! Please sign in.";
  const iconColor = theme === "light" ? "#5B636F" : "#A8B0C0";

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, slideUp]);

  const styles = useMemo(
    () =>
      createStyles({
        accentColor,
        theme,
        orientation,
        screenWidth,
        containerBackground,
      }),
    [accentColor, theme, orientation, screenWidth, containerBackground],
  );

  const placeholderColor = theme === "light" ? "#8C95A3" : "#7D8494";

  const animatedIntro = {
    opacity: fadeIn,
    transform: [{ translateY: slideUp }],
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={theme === "light" ? "dark-content" : "light-content"}
        backgroundColor={containerBackground}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View style={[styles.headerContainer, animatedIntro]}>
            <View style={styles.logoBadge}>
              <View style={styles.logoInner} />
            </View>
            <Text style={styles.headerTitle}>
              {translations[language].login}
            </Text>
            <Text style={styles.headerSubtitle}>{subtitleText}</Text>
            <View style={styles.headerControls}>
              <HeaderToggleButton
                label={language.toUpperCase()}
                onPress={toggleLanguage}
                styles={styles}
              />
              <HeaderToggleButton
                label={theme === "light" ? "🌙" : "☀️"}
                onPress={toggleTheme}
                styles={styles}
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.formCard, animatedIntro]}>
            <InputField
              label={translations[language].email}
              value={email}
              placeholder={translations[language].email}
              onChangeText={setEmail}
              keyboardType="email-address"
              styles={styles}
              placeholderColor={placeholderColor}
            />
            <InputField
              label={translations[language].password}
              value={password}
              placeholder={translations[language].password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              trailingIcon={
                <Pressable
                  onPress={() => setPasswordVisible((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.inputIconButton,
                    pressed && styles.inputIconButtonPressed,
                  ]}
                  hitSlop={8}
                >
                  <Ionicons
                    name={passwordVisible ? "eye-off" : "eye"}
                    size={18}
                    color={iconColor}
                  />
                </Pressable>
              }
              styles={styles}
              placeholderColor={placeholderColor}
            />

            {loading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="small" color={accentColor} />
              </View>
            ) : (
              <>
                <AccentButton
                  label={translations[language].login}
                  onPress={signIn}
                  variant="primary"
                  styles={styles}
                />
                <AccentButton
                  label={translations[language].goToSignup}
                  onPress={() => navigation.navigate("Signup")}
                  variant="secondary"
                  styles={styles}
                />
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const createStyles = ({
  accentColor,
  theme,
  orientation,
  screenWidth,
  containerBackground,
}: {
  accentColor: string;
  theme: "light" | "dark";
  orientation: "portrait" | "landscape";
  screenWidth: number;
  containerBackground: string;
}) => {
  const isPortrait = orientation === "portrait";
  const baseCardWidth = isPortrait ? screenWidth - 40 : screenWidth * 0.55;
  const maxWidth = Math.min(baseCardWidth, 480);

  const cardLight = "rgba(255,255,255,0.92)";
  const cardDark = "rgba(18,22,28,0.9)";

  const titleFont = Platform.select({
    ios: "SFProDisplay-Bold",
    android: "sans-serif-medium",
    default: "System",
  });

  const textFont = Platform.select({
    ios: "SFProText-Regular",
    android: "sans-serif",
    default: "System",
  });

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: containerBackground,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: isPortrait ? 20 : 48,
      paddingVertical: isPortrait ? 32 : 24,
    },
    headerContainer: {
      width: "100%",
      maxWidth,
      alignItems: "center",
      marginBottom: 24,
    },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme === "light" ? "#FFFFFF" : "#12161C",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      shadowColor: "#000",
      shadowOpacity: theme === "light" ? 0.12 : 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    logoInner: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: accentColor,
      opacity: 0.85,
    },
    headerTitle: {
      fontSize: 34,
      fontWeight: "700",
      fontFamily: titleFont,
      color: theme === "light" ? "#0B0D11" : "#F1F3F5",
      textAlign: "center",
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      marginTop: 8,
      fontSize: 16,
      fontFamily: textFont,
      color: theme === "light" ? "#5B6573" : "#9AA3B4",
      textAlign: "center",
      lineHeight: 22,
    },
    headerControls: {
      flexDirection: "row",
      marginTop: 20,
      justifyContent: "center",
    },
    toggleControl: {
      minWidth: 48,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 18,
      backgroundColor: theme === "light" ? "#FFFFFF" : "#1A1F27",
      borderWidth: theme === "light" ? 1 : 0,
      borderColor: "rgba(10,10,10,0.05)",
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 6,
      shadowColor: "#000000",
      shadowOpacity: theme === "light" ? 0.08 : 0.26,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    toggleControlPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.85,
    },
    toggleLabel: {
      fontSize: 14,
      fontWeight: "600",
      fontFamily: textFont,
      color: theme === "light" ? "#1E1F24" : "#E5E9F0",
    },
    formCard: {
      width: "100%",
      maxWidth,
      borderRadius: 28,
      paddingHorizontal: isPortrait ? 28 : 32,
      paddingVertical: isPortrait ? 32 : 30,
      backgroundColor: theme === "light" ? cardLight : cardDark,
      shadowColor: "#000",
      shadowOpacity: theme === "light" ? 0.12 : 0.3,
      shadowRadius: 40,
      shadowOffset: { width: 0, height: 25 },
      elevation: theme === "light" ? 12 : 18,
    },
    inputBlock: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      fontFamily: textFont,
      color: theme === "light" ? "#1E1F24" : "#D6DBE4",
      marginBottom: 8,
      letterSpacing: 0.2,
    },
    inputControl: {
      height: 56,
      borderRadius: 18,
      paddingHorizontal: 18,
      backgroundColor: theme === "light" ? "#F5F7FB" : "#131821",
      borderWidth: theme === "light" ? 0 : 1,
      borderColor: "rgba(255,255,255,0.04)",
      color: theme === "light" ? "#0B0D11" : "#FFFFFF",
      fontSize: 16,
      fontFamily: textFont,
      shadowColor: theme === "light" ? "#C7D1E6" : "#000",
      shadowOpacity: theme === "light" ? 0.35 : 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: theme === "light" ? 6 : 0,
    },
    inputControlWrapper: {
      position: "relative",
      justifyContent: "center",
    },
    inputIcon: {
      position: "absolute",
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      color: theme === "light" ? "#5B636F" : "#A8B0C0",
    },
    inputIconButton: {
      padding: 6,
      borderRadius: 12,
    },
    inputIconButtonPressed: {
      opacity: 0.7,
    },
    loadingWrapper: {
      height: 56,
      borderRadius: 18,
      backgroundColor: theme === "light" ? "#E9EDF6" : "#0F141C",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
      marginBottom: 12,
    },
    buttonWrapper: {
      marginTop: 12,
      borderRadius: 18,
      overflow: "hidden",
    },
    buttonWrapperPressed: {
      opacity: 0.92,
    },
    buttonBase: {
      height: 58,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
    },
    buttonPrimary: {
      backgroundColor: accentColor,
    },
    buttonSecondary: {
      backgroundColor: theme === "light" ? "#FFFFFF" : "transparent",
      borderWidth: 1,
      borderColor: theme === "light" ? "rgba(10,132,255,0.25)" : accentColor,
    },
    buttonTextPrimary: {
      fontSize: 17,
      fontWeight: "600",
      fontFamily: textFont,
      color: "#FFFFFF",
      letterSpacing: 0.4,
    },
    buttonTextSecondary: {
      fontSize: 17,
      fontWeight: "600",
      fontFamily: textFont,
      color: accentColor,
      letterSpacing: 0.4,
    },
  });
};

type LoginStyles = ReturnType<typeof createStyles>;

type HeaderToggleButtonProps = {
  label: string;
  onPress: () => void;
  styles: LoginStyles;
};

// Herbruikbare knop voor header toggles (taal/thema) met visuele feedback.
function HeaderToggleButton({
  label,
  onPress,
  styles,
}: HeaderToggleButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleControl,
        pressed && styles.toggleControlPressed,
      ]}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
  styles: LoginStyles;
  placeholderColor: string;
  trailingIcon?: React.ReactNode;
};

// Invoercomponent die label en TextInput bundelt voor consistente styling.
function InputField({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = "default",
  secureTextEntry,
  styles,
  placeholderColor,
  trailingIcon,
}: InputFieldProps) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputControlWrapper}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
          style={styles.inputControl}
        />
        {trailingIcon ? (
          <View style={styles.inputIcon}>{trailingIcon}</View>
        ) : null}
      </View>
    </View>
  );
}

type AccentButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  styles: LoginStyles;
};

function AccentButton({
  label,
  onPress,
  variant = "primary",
  styles,
}: AccentButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 15,
      bounciness: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 15,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        styles.buttonWrapper,
        pressed && styles.buttonWrapperPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.buttonBase,
          variant === "primary" ? styles.buttonPrimary : styles.buttonSecondary,
          { transform: [{ scale }] },
        ]}
      >
        <Text
          style={
            variant === "primary"
              ? styles.buttonTextPrimary
              : styles.buttonTextSecondary
          }
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default Login;
