import { io, type Socket } from "socket.io-client";
import type { Session } from "./core/session";
import type {
  ChatClient,
  ChatEvent,
  Conversation,
  InboxPage,
  Message,
  MessagePage,
  User,
} from "./core/types";

export class LiveClient implements ChatClient {
  preview = false;
  user: User;
  private session: Session;
  private socket: Socket;
  private active = true;
  private closed = false;
  private renewing = false;
  private online = new Set<string>();
  private listeners = new Set<(event: ChatEvent) => void>();
  constructor(session: Session, apiUrl: string) {
    this.session = session;
    this.user = session.getSnapshot().user!;
    this.socket = io(new URL(apiUrl).origin, {
      autoConnect: false,
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      auth: (callback) => {
        callback({ token: session.getToken() });
      },
    });
    this.socket.on("connect", () => {
      this.emit({ type: "connection", value: "connected" });
      this.emit({ type: "sync" });
      this.socket
        .timeout(10000)
        .emit(
          "presence:sync",
          (
            error: Error | null,
            result: { success: boolean; onlineUserIds: string[] },
          ) => {
            if (!error && result?.success) {
              this.online = new Set(result.onlineUserIds);
              this.emit({ type: "presence", userIds: [...this.online] });
            }
          },
        );
    });
    this.socket.on("disconnect", () => {
      this.online.clear();
      this.emit({ type: "presence", userIds: [] });
      this.emit({ type: "connection", value: "offline" });
    });
    this.socket.on("connect_error", (error) => {
      this.emit({ type: "connection", value: "offline" });
      if (
        ["INVALID_ACCESS_TOKEN", "AUTHENTICATION_REQUIRED"].includes(
          error.data?.code,
        )
      )
        void this.renew();
    });
    this.socket.on("auth:expired", () => {
      void this.renew();
    });
    this.socket.on("message:new", (message: Message) => {
      this.emit({ type: "message", message });
      if (message.senderId !== this.user.id)
        this.socket.emit("message:delivered", { messageId: message.id });
    });
    this.socket.on(
      "conversation:read",
      (event: { conversationId: string; userId: string }) =>
        this.emit({ type: "read", ...event }),
    );
    this.socket.on(
      "presence:update",
      (event: { userId: string; status: string }) => {
        if (event.status === "ONLINE") this.online.add(event.userId);
        else this.online.delete(event.userId);
        this.emit({ type: "presence", userIds: [...this.online] });
      },
    );
  }
  private emit(event: ChatEvent) {
    if (!this.closed) this.listeners.forEach((fn) => fn(event));
  }
  private async renew() {
    if (this.renewing || !this.active || this.closed) return;
    this.renewing = true;
    try {
      await this.session.refresh();
      if (!this.closed && this.active) this.socket.disconnect().connect();
    } catch {
      this.emit({ type: "connection", value: "offline" });
    } finally {
      this.renewing = false;
    }
  }
  inbox(cursor?: string) {
    return this.session.request<InboxPage>(
      "/conversations?limit=30" +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""),
    );
  }
  history(id: string, before?: string) {
    return this.session.request<MessagePage>(
      `/conversations/${id}/messages?limit=50` +
        (before ? `&before=${encodeURIComponent(before)}` : ""),
    );
  }
  async search(query: string) {
    return (
      await this.session.request<{ users: User[] }>(
        `/users/search?q=${encodeURIComponent(query.trim())}&limit=15`,
      )
    ).users;
  }
  async direct(user: User) {
    const conversation = await this.session.request<Conversation>(
      "/conversations/direct",
      { method: "POST", body: { participantId: user.id } },
    );
    return { ...conversation, unreadCount: 0, lastMessage: null };
  }
  async send(
    conversationId: string,
    content: string,
    clientMessageId: string,
  ): Promise<Message> {
    await this.session.freshToken();
    if (!this.socket.connected)
      throw new Error(
        "You are offline. Reconnect, then tap the message to retry.",
      );
    return new Promise((resolve, reject) => {
      this.socket
        .timeout(12000)
        .emit(
          "message:send",
          { conversationId, content, clientMessageId },
          (
            error: Error | null,
            result: {
              success: boolean;
              message: Message;
              error?: { message: string };
            },
          ) => {
            if (error)
              reject(new Error("Confirmation timed out. Tap to retry safely."));
            else if (!result?.success)
              reject(
                new Error(
                  result?.error?.message || "Message could not be sent.",
                ),
              );
            else resolve(result.message);
          },
        );
    });
  }
  read(conversationId: string, messageId: string): Promise<void> {
    if (!this.socket.connected) return Promise.reject(new Error("Offline"));
    return new Promise((resolve, reject) =>
      this.socket
        .timeout(10000)
        .emit(
          "conversation:read",
          { conversationId, messageId },
          (error: Error | null, result: { success: boolean }) =>
            error || !result?.success
              ? reject(error || new Error("Read acknowledgement failed"))
              : resolve(),
        ),
    );
  }
  subscribe(listener: (event: ChatEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      this.socket.disconnect();
      return;
    }
    this.emit({ type: "connection", value: "connecting" });
    void this.session
      .freshToken()
      .then(() => {
        if (!this.closed && this.active) this.socket.connect();
      })
      .catch(() => this.emit({ type: "connection", value: "offline" }));
  }
  close() {
    this.closed = true;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.listeners.clear();
  }
}
