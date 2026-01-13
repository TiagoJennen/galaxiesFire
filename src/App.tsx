import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import Login from "./screens/Login";
import List from "./screens/List";
import { onAuthStateChanged, User } from "firebase/auth";
import { FIREBASE_AUTH } from "./services/FirebaseConfig";
import { StatusBar } from "expo-status-bar";

type RootStackParamList = {
  Inside: undefined;
  Login: undefined;
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
  const ToDoListScreen: React.FC<
    NativeStackScreenProps<InsideStackParamList, "ToDoList">
  > = () => (
    <List
      theme={theme}
      toggleTheme={toggleTheme}
      language={language}
      toggleLanguage={toggleLanguage}
    />
  );

  return (
    <InsideStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme === "light" ? "#fff" : "#000" },
        headerTintColor: theme === "light" ? "#000" : "#fff",
      }}
      children={
        <InsideStack.Screen
          name="ToDoList"
          component={ToDoListScreen}
          options={{}}
        />
      }
    />
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
      <NavigationContainer
        children={
          <Stack.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: theme === "light" ? "#fff" : "#000",
              },
              headerTintColor: theme === "light" ? "#000" : "#fff",
            }}
            children={
              user ? (
                <Stack.Screen
                  name="Inside"
                  options={{ headerShown: false }}
                  children={() => (
                    <InsideLayout
                      theme={theme}
                      toggleTheme={toggleTheme}
                      language={language}
                      toggleLanguage={toggleLanguage}
                    />
                  )}
                />
              ) : (
                <Stack.Screen
                  name="Login"
                  options={{ headerShown: false }}
                  children={() => (
                    <Login
                      theme={theme}
                      toggleTheme={toggleTheme}
                      language={language}
                      toggleLanguage={toggleLanguage}
                    />
                  )}
                />
              )
            }
          />
        }
      />
    </>
  );
}
