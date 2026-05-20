import React, { useEffect, useState, useRef } from "react";
import { useColorScheme } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "./screens/Login";
import Signup from "./screens/Signup";
import List from "./screens/List";
import { onAuthStateChanged, User } from "firebase/auth";
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
  const navigationRef = useRef<any>(null);

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
      // Subscribe to auth state changes and update local state.
      // Do not sign out on startup — preserve existing sessions so
      // newly-registered users remain signed in.
      if (!isMounted) return;

      unsubscribe = onAuthStateChanged(FIREBASE_AUTH, (usr) => {
        console.log('onAuthStateChanged user:', usr ? { uid: usr.uid, email: usr.email } : null);
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

  // Reset navigation whenever auth state changes after the navigator is ready.
  useEffect(() => {
    if (loading) return;
    const nav = navigationRef.current;
    if (!nav) return;

    try {
      console.log('Auth change effect: user=', user ? user.uid : null);
      if (!user) {
        nav.reset({ index: 0, routes: [{ name: "Login" }] });
      } else {
        nav.reset({ index: 0, routes: [{ name: "Inside" }] });
      }
    } catch (e) {
      // navigation may not be ready; ignore and allow onReady handler to run.
    }
  }, [user, loading]);

  if (loading) return null;

  return (
    <>
      <StatusBar style={theme === "light" ? "dark" : "light"} hidden={false} />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          if (!user) {
            // Reset to login when auth state changes
            const state = navigationRef.current?.getRootState();
            if (state?.routes[0]?.name !== "Login") {
              navigationRef.current?.reset({
                index: 0,
                routes: [{ name: "Login" }],
              });
            }
          }
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: theme === "light" ? "#fff" : "#000",
            },
            headerTintColor: theme === "light" ? "#000" : "#fff",
          }}
          initialRouteName={user ? "Inside" : "Login"}
        >
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
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
