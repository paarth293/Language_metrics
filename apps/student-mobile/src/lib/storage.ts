/**
 * Language Metrics Mobile — Secure Storage Architecture
 *
 * Compliance Rule:
 * Refresh tokens MUST be saved to the OS-level Secure Enclave (iOS Keychain / Android Keystore)
 * via `expo-secure-store`. Short-lived access tokens remain in memory only.
 * NEVER use plain AsyncStorage for credentials or session tokens.
 */

const REFRESH_TOKEN_KEY = "lm_student_refresh_token";

// In-memory token cache for short-lived access token
let memoryAccessToken: string | null = null;

// Dynamic import / fallback helper for environments where expo-secure-store native module is unlinked
let secureStoreModule: typeof import("expo-secure-store") | null = null;

async function getSecureStore() {
  if (secureStoreModule) return secureStoreModule;
  try {
    secureStoreModule = await import("expo-secure-store");
    return secureStoreModule;
  } catch {
    return null;
  }
}

// Fallback in-memory store for unit test runners & mock environments
const mockEnclave = new Map<string, string>();

export const TokenStorage = {
  /**
   * Set the short-lived access token in volatile memory.
   */
  setAccessToken(token: string | null): void {
    memoryAccessToken = token;
  },

  /**
   * Retrieve the short-lived access token from memory.
   */
  getAccessToken(): string | null {
    return memoryAccessToken;
  },

  /**
   * Securely persist the refresh token in OS Keystore / Keychain.
   */
  async setRefreshToken(token: string): Promise<void> {
    const store = await getSecureStore();
    if (store && (await store.isAvailableAsync())) {
      await store.setItemAsync(REFRESH_TOKEN_KEY, token, {
        keychainAccessible: store.AFTER_FIRST_UNLOCK,
      });
    } else {
      mockEnclave.set(REFRESH_TOKEN_KEY, token);
    }
  },

  /**
   * Retrieve the refresh token from OS Keystore / Keychain.
   */
  async getRefreshToken(): Promise<string | null> {
    const store = await getSecureStore();
    if (store && (await store.isAvailableAsync())) {
      return await store.getItemAsync(REFRESH_TOKEN_KEY);
    }
    return mockEnclave.get(REFRESH_TOKEN_KEY) || null;
  },

  /**
   * Clear both volatile access token and OS-level refresh token on logout.
   */
  async clearAllTokens(): Promise<void> {
    memoryAccessToken = null;
    const store = await getSecureStore();
    if (store && (await store.isAvailableAsync())) {
      await store.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
    mockEnclave.delete(REFRESH_TOKEN_KEY);
  },
};
