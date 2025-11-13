import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import Login from "./app/screens/Login";
import List from "./app/screens/List";
import { onAuthStateChanged, User } from "firebase/auth";
import { FIREBASE_AUTH } from "./FirebaseConfig";
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
        headerStyle: { backgroundColor: theme === "light" ? "#fff" : "#000" },
        headerTintColor: theme === "light" ? "#000" : "#fff",
      }}
      children={
        <InsideStack.Screen
          name="ToDoList"
          component={ToDoListScreen}
          options={{ title: "To-Do List" }}
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

  const InsideScreen: React.FC<
    NativeStackScreenProps<RootStackParamList, "Inside">
  > = () => (
    <InsideLayout
      theme={theme}
      toggleTheme={toggleTheme}
      language={language}
      toggleLanguage={toggleLanguage}
    />
  );

  const LoginScreen: React.FC<
    NativeStackScreenProps<RootStackParamList, "Login">
  > = () => (
    <Login
      theme={theme}
      toggleTheme={toggleTheme}
      language={language}
      toggleLanguage={toggleLanguage}
    />
  );

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
                  component={InsideScreen}
                  options={{ headerShown: false }}
                />
              ) : (
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ headerShown: false }}
                />
              )
            }
          />
        }
      />
    </>
  );
}
