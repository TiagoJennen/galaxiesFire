import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "./app/screens/Login";
import List from "./app/screens/List";
import { onAuthStateChanged, User } from "firebase/auth";
import { FIREBASE_AUTH } from "./FirebaseConfig";
import { StatusBar } from "expo-status-bar";

const Stack = createNativeStackNavigator();
const InsideStack = createNativeStackNavigator();

interface ThemeProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  language: "nl" | "en";
  toggleLanguage: () => void;
}

function InsideLayout({
  theme,
  toggleTheme,
  language,
  toggleLanguage,
}: ThemeProps) {
  // Inside navigatie met thema + taal
  return (
    <InsideStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme === "light" ? "#fff" : "#000" },
        headerTintColor: theme === "light" ? "#000" : "#fff",
      }}
    >
      <InsideStack.Screen name="To-Do List">
        {(props) => (
          <List
            {...props}
            theme={theme}
            toggleTheme={toggleTheme}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}
      </InsideStack.Screen>
    </InsideStack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<"light" | "dark">(systemScheme || "light");
  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const [language, setLanguage] = useState<"nl" | "en">("nl");
  const toggleLanguage = () =>
    setLanguage((prev) => (prev === "nl" ? "en" : "nl"));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(FIREBASE_AUTH, (usr) => {
      setUser(usr);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return null;

  return (
    <>
      <StatusBar style={theme === "light" ? "dark" : "light"} hidden={false} />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: theme === "light" ? "#fff" : "#000",
            },
            headerTintColor: theme === "light" ? "#000" : "#fff",
          }}
        >
          {user ? (
            <Stack.Screen name="Inside" options={{ headerShown: false }}>
              {(props) => (
                <InsideLayout
                  {...props}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  language={language}
                  toggleLanguage={toggleLanguage}
                />
              )}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {(props) => (
                <Login
                  {...props}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  language={language}
                  toggleLanguage={toggleLanguage}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
