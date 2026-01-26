import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "./screens/Login";
import Signup from "./screens/Signup";
import List from "./screens/List";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { FIREBASE_AUTH } from "./services/FirebaseConfig";
import { StatusBar } from "expo-status-bar";

type RootStackParamList = {
  Inside: undefined;
  Login: undefined;
  Signup: undefined;
};

type InsideStackParamList = {
  ToDoList: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const InsideStack = createNativeStackNavigator<InsideStackParamList>();

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
  return (
    <InsideStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme === "light" ? "#fff" : "#000" },
        headerTintColor: theme === "light" ? "#000" : "#fff",
      }}
    >
      <InsideStack.Screen name="ToDoList" options={{}}>
        {() => (
          <List
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
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const initialiseSession = async () => {
      try {
        await signOut(FIREBASE_AUTH);
      } catch (error) {
        console.log("Failed to reset auth session:", error);
      }

      if (!isMounted) {
        return;
      }

      unsubscribe = onAuthStateChanged(FIREBASE_AUTH, (usr) => {
        setUser(usr);
        setLoading(false);
      });
    };

    initialiseSession();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
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
              {() => (
                <InsideLayout
                  theme={theme}
                  toggleTheme={toggleTheme}
                  language={language}
                  toggleLanguage={toggleLanguage}
                />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Login" options={{ headerShown: false }}>
                {() => (
                  <Login
                    theme={theme}
                    toggleTheme={toggleTheme}
                    language={language}
                    toggleLanguage={toggleLanguage}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Signup" options={{ headerShown: false }}>
                {() => (
                  <Signup
                    theme={theme}
                    toggleTheme={toggleTheme}
                    language={language}
                    toggleLanguage={toggleLanguage}
                  />
                )}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
