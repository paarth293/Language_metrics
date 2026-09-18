/**
 * Non-sensitive user preferences (currently: theme).
 *
 * Native: expo-secure-store (already a dependency; values are tiny).
 * Web:    localStorage under the same key the web portal uses (`lm-theme`).
 * Every read/write is best-effort — a failure just falls back to defaults.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const THEME_KEY = "lm-theme";

export type ThemePreference = "system" | "light" | "dark";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function getWebStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const value =
      Platform.OS === "web"
        ? getWebStorage()?.getItem(THEME_KEY)
        : (await SecureStore.isAvailableAsync())
          ? await SecureStore.getItemAsync(THEME_KEY)
          : null;
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    if (Platform.OS === "web") {
      getWebStorage()?.setItem(THEME_KEY, preference);
      return;
    }
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(THEME_KEY, preference);
    }
  } catch {
    // Preference persistence is best-effort.
  }
}
