/**
 * Language Metrics — Student Mobile
 *
 * Providers:  SafeArea → Theme (light/dark, mirrors web tokens) → Auth (secure-enclave session)
 * Routing:    restoring → (offline) → signed-out: Login → signed-in: Discover / Classes / Wallet / Profile
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MainScreen } from "./src/screens/MainScreen";
import { OfflineScreen, RestoringScreen } from "./src/screens/SessionScreens";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";

function RootNavigator() {
  const { status } = useAuth();
  const { colors, scheme } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {status === "restoring" && <RestoringScreen />}
      {status === "offline" && <OfflineScreen />}
      {status === "signed-out" && <LoginScreen />}
      {status === "signed-in" && <MainScreen />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
