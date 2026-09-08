declare module "expo-secure-store" {
  export const AFTER_FIRST_UNLOCK: string;
  export function isAvailableAsync(): Promise<boolean>;
  export function setItemAsync(key: string, value: string, options?: { keychainAccessible?: string }): Promise<void>;
  export function getItemAsync(key: string): Promise<string | null>;
  export function deleteItemAsync(key: string): Promise<void>;
}
