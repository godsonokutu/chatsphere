import { ApiError } from "./http.ts";
import type { RequestOptions, Transport } from "./http.ts";
import type { User } from "./types.ts";

export interface SecretStore {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
}
type SessionResult = {
  user: User;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
};
type Snapshot = {
  status: "restoring" | "signed-out" | "ready" | "unavailable";
  user: User | null;
  error?: string;
};

// One owner and one refresh flight per app instance. Access tokens stay in memory.
export class Session {
  private transport: Transport;
  private store: SecretStore;
  private token: string | null = null;
  private expiresAt = 0;
  private revision = 0;
  private flight: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = { status: "restoring", user: null };

  constructor(transport: Transport, store: SecretStore) {
    this.transport = transport;
    this.store = store;
  }
  getSnapshot = () => this.snapshot;
  getToken = () => this.token;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((fn) => fn());
  }
  private write(task: () => Promise<void>) {
    this.writes = this.writes.catch(() => {}).then(task);
    return this.writes;
  }
  private async accept(result: SessionResult, revision: number) {
    if (revision !== this.revision)
      throw new ApiError(
        "Session changed. Please try again.",
        401,
        "SESSION_CHANGED",
      );
    if (
      !result?.user?.id ||
      !result.accessToken ||
      !result.refreshToken ||
      !(result.accessTokenExpiresIn > 0)
    ) {
      throw new ApiError(
        "Unexpected session response. Please sign in again.",
        502,
        "INVALID_RESPONSE",
      );
    }
    await this.write(async () => {
      if (revision === this.revision) await this.store.set(result.refreshToken);
    });
    if (revision !== this.revision)
      throw new ApiError("Session changed.", 401, "SESSION_CHANGED");
    this.token = result.accessToken;
    this.expiresAt = Date.now() + result.accessTokenExpiresIn * 1000;
    this.update({ status: "ready", user: result.user });
  }
  async login(identity: string, password: string) {
    const revision = ++this.revision;
    const result = await this.transport<SessionResult>("/auth/mobile/login", {
      method: "POST",
      body: {
        ...(identity.includes("@")
          ? { email: identity.trim() }
          : { phoneNumber: identity.trim() }),
        password,
      },
    });
    await this.accept(result, revision);
  }
  async restore() {
    this.update({ status: "restoring", user: null });
    try {
      if (!(await this.store.get())) {
        this.update({ status: "signed-out", user: null });
        return;
      }
      await this.refresh();
    } catch (error) {
      if (this.snapshot.status !== "signed-out")
        this.update({
          status: "unavailable",
          user: null,
          error: (error as Error).message,
        });
    }
  }
  refresh = async (): Promise<void> => {
    if (this.flight) return this.flight;
    const revision = this.revision;
    const operation = (async () => {
      try {
        const refreshToken = await this.store.get();
        if (!refreshToken)
          throw new ApiError(
            "Please sign in again.",
            401,
            "INVALID_REFRESH_TOKEN",
          );
        const result = await this.transport<SessionResult>(
          "/auth/mobile/refresh",
          { method: "POST", body: { refreshToken } },
        );
        await this.accept(result, revision);
      } catch (error) {
        if (
          revision === this.revision &&
          error instanceof ApiError &&
          [401, 403].includes(error.status)
        ) {
          this.token = null;
          await this.write(() => this.store.remove());
          this.update({
            status: "signed-out",
            user: null,
            error: "Your session ended. Please sign in again.",
          });
        }
        throw error;
      }
    })();
    this.flight = operation;
    try {
      await operation;
    } finally {
      if (this.flight === operation) this.flight = null;
    }
  };
  async freshToken() {
    if (!this.token || Date.now() >= this.expiresAt - 30000)
      await this.refresh();
    if (!this.token)
      throw new ApiError(
        "Please sign in again.",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    return this.token;
  }
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const revision = this.revision;
    const token = await this.freshToken();
    try {
      return await this.transport<T>(path, { ...options, token });
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status !== 401 ||
        revision !== this.revision
      )
        throw error;
      // A late 401 from an old request must not rotate the new token again.
      if (this.token === token) await this.refresh();
      return this.transport<T>(path, {
        ...options,
        token: await this.freshToken(),
      });
    }
  }
  async logout(): Promise<boolean> {
    let revoked = false;
    try {
      await this.request("/auth/logout", { method: "POST" });
      revoked = true;
    } catch {
      /* Local removal must remain available without a network. */
    } finally {
      await this.clear();
    }
    return revoked;
  }
  async clear() {
    ++this.revision;
    this.token = null;
    this.expiresAt = 0;
    await this.write(() => this.store.remove());
    this.update({ status: "signed-out", user: null });
  }
}
