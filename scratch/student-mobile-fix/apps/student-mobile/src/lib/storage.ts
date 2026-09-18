/**
 * Language Metrics Mobile — Secure token storage
 *
 * Compliance rule (MOBILE_RESPONSIVE_SIGNOFF.md, "Mobile Token Security"):
 *   - Refresh tokens live in the OS secure enclave (iOS Keychain / Android Keystore)
 *     via `expo-secure-store`.
 *   - Short-lived access tokens live in memory only.
 *   - Never AsyncStorage / localStorage for credentials.
 *
 * Expo web has no secure enclave (`isAvailableAsync()` is false in the browser), so
 * the refresh token is held in memory there: a browser reload signs the student out,
 * which is the safe behaviour for a development preview.
 */

import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "lm_student_refresh_token";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let secureStoreAvailable: Promise<boolean> | null = null;

function isSecureStoreAvailable(): Promise<boolean> {
  if (!secureStoreAvailable) {
    secureStoreAvailable = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureStoreAvailable;
}

export const TokenStorage = {
  setAccessToken(token: string | null): void {
    memoryAccessToken = token;
  },

  getAccessToken(): string | null {
    return memoryAccessToken;
  },

  async setRefreshToken(token: string): Promise<void> {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      return;
    }
    memoryRefreshToken = token;
  },

  async getRefreshToken(): Promise<string | null> {
    if (await isSecureStoreAvailable()) {
      return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
    return memoryRefreshToken;
  },

  async clearAllTokens(): Promise<void> {
    memoryAccessToken = null;
    memoryRefreshToken = null;
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  },
};
