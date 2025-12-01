import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { FIREBASE_AUTH } from "../services/FirebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { translations } from "../constants/translations";

// Props die de login screen verwacht:
// - theme: 'light' of 'dark' voor styling
// - toggleTheme: functie om thema te wisselen
// - language: 'nl' of 'en' voor meertaligheid
// - toggleLanguage: functie om taal te wisselen

interface Props {
  theme: "light" | "dark";
  toggleTheme: () => void;
  language: "nl" | "en";
  toggleLanguage: () => void;
}

const Login: React.FC<Props> = ({
  // component props worden hier ontdaan
  theme,
  toggleTheme,
  language,
  toggleLanguage,
}) => {
  // lokale state voor form velden en laadstatus
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // state voor schermgrootte en oriëntatie zodat layout reageert
  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get("window").width
  );
  const [screenHeight, setScreenHeight] = useState(
    Dimensions.get("window").height
  );
  const [orientation, setOrientation] = useState(
    screenWidth < screenHeight ? "portrait" : "landscape"
  );

  useEffect(() => {
    // Luister naar veranderingen in schermgrootte (rotatie/resize)
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreenWidth(window.width);
      setScreenHeight(window.height);
      setOrientation(window.width < window.height ? "portrait" : "landscape");
    });
    // clean-up bij unmount
    return () => subscription?.remove();
  }, []);

  // Functie om bestaande gebruiker in te laten loggen met Firebase Auth
  const signIn = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(FIREBASE_AUTH, email, password);
      // bij succesvolle login wordt navigation/redirect ergens anders afgehandeld
    } catch (error: any) {
      // toon foutmelding in de geselecteerde taal
      alert(translations[language].loginFailed + " " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Functie om nieuwe gebruiker te registreren met Firebase Auth
  const signUp = async () => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(FIREBASE_AUTH, email, password);
      // na registratie informeren we de gebruiker om zijn/haar mail te checken
      alert(translations[language].checkMail);
    } catch (error: any) {
      alert(translations[language].signupFailed + " " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Dynamische styles die reageren op thema en oriëntatie
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme === "light" ? "#3A86FFFF" : "#222",
    },
    header: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: orientation === "portrait" ? 80 : 40,
      marginBottom: orientation === "portrait" ? 40 : 20,
    },
    title: {
      fontSize:
        orientation === "portrait" ? screenWidth * 0.12 : screenWidth * 0.06,
      fontWeight: "800",
      color: "#fff",
      textAlign: "center",
    },
    headerButtons: {
      flexDirection: "row",
      marginTop: 10,
      justifyContent: "center",
      gap: 10,
    },
    toggleButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: "#6c757d",
      borderRadius: 8,
    },
    languageButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: "#6c757d",
      borderRadius: 8,
    },
    formBox: {
      flex: 1,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      padding: 20,
      marginHorizontal: orientation === "portrait" ? 20 : 40,
      justifyContent: "center",
      backgroundColor: theme === "light" ? "#fff" : "#333",
    },
    inputContainer: { marginBottom: 15 },
    label: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 5,
      color: theme === "light" ? "#333" : "#eee",
    },
    input: {
      height: 50,
      borderWidth: 1,
      borderColor: theme === "light" ? "#ccc" : "#555",
      borderRadius: 8,
      paddingHorizontal: 10,
      marginBottom: 15,
      backgroundColor: theme === "light" ? "#fff" : "#444",
      color: theme === "light" ? "#000" : "#fff",
    },
    button: {
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 10,
      backgroundColor: "#3A86FFFF",
    },
    buttonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  });

  return (
    <View style={styles.container}>
      {/* Header: titel en knoppen om taal/thema te wisselen */}
      <View style={styles.header}>
        <Text style={styles.title}>{translations[language].welcome}</Text>
        <View style={styles.headerButtons}>
          {/* Taal wisselknop - toont huidige taal (NL/EN) */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={toggleLanguage}
          >
            <Text style={styles.buttonText}>{language.toUpperCase()}</Text>
          </TouchableOpacity>
          {/* Thema wisselknop - toont icoon voor dag/nacht */}
          <TouchableOpacity style={styles.toggleButton} onPress={toggleTheme}>
            <Text style={styles.buttonText}>
              {theme === "light" ? "🌙" : "☀️"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KeyboardAvoidingView voorkomt dat het toetsenbord velden bedekt op iOS */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.formBox}>
            {/* Formulier: email + wachtwoord */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{translations[language].email}</Text>
              <TextInput
                value={email}
                style={styles.input}
                placeholder={translations[language].email}
                placeholderTextColor={theme === "light" ? "#888" : "#aaa"}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
              />
              <Text style={styles.label}>
                {translations[language].password}
              </Text>
              <TextInput
                value={password}
                style={styles.input}
                placeholder={translations[language].password}
                placeholderTextColor={theme === "light" ? "#888" : "#aaa"}
                autoCapitalize="none"
                secureTextEntry
                onChangeText={setPassword}
              />
            </View>

            {/* Toon laadindicator tijdens netwerkacties */}
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#3A86FFFF"
                style={{ marginTop: 20 }}
              />
            ) : (
              <>
                {/* Login knop */}
                <TouchableOpacity style={styles.button} onPress={signIn}>
                  <Text style={styles.buttonText}>
                    {translations[language].login}
                  </Text>
                </TouchableOpacity>

                {/* Registratie knop */}
                <TouchableOpacity
                  style={[styles.button, { marginTop: 10 }]}
                  onPress={signUp}
                >
                  <Text style={styles.buttonText}>
                    {translations[language].signup}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default Login;
