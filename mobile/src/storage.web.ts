import type { SecretStore } from "./core/session";
// Browser preview never persists a refresh token in localStorage or cookies.
let secret: string | null = null;
export const secretStore: SecretStore = {
  get: async () => secret,
  set: async (value) => {
    secret = value;
  },
  remove: async () => {
    secret = null;
  },
};
