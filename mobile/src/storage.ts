import * as SecureStore from "expo-secure-store";
import type { SecretStore } from "./core/session";
const key = "chatsphere.refresh.v1";
export const secretStore: SecretStore = {
  get: () => SecureStore.getItemAsync(key),
  set: (value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: () => SecureStore.deleteItemAsync(key),
};
