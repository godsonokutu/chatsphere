import type {
  ChatClient,
  ChatEvent,
  Conversation,
  InboxPage,
  Message,
  MessagePage,
  User,
} from "./core/types";

// Explicit, local-only sample data. Never used as an API fallback.
export class PreviewClient implements ChatClient {
  preview = true;
  user: User = { id: "1", username: "Godson", email: "Sample account" };
  private listeners = new Set<(event: ChatEvent) => void>();
  private people: User[] = [
    { id: "2", username: "Ama Mensah" },
    { id: "3", username: "Kwame Asante" },
    { id: "4", username: "Esi Addo" },
    { id: "5", username: "Daniel Owusu" },
  ];
  private messages: Record<string, Message[]>;
  private conversations: Conversation[];
  constructor() {
    const time = (minutes: number) =>
      new Date(Date.now() - minutes * 60000).toISOString();
    const message = (
      id: string,
      conversationId: string,
      senderId: string,
      content: string,
      minutes: number,
    ): Message => ({
      id,
      conversationId,
      senderId,
      content,
      clientMessageId: `preview-message-${id}`,
      createdAt: time(minutes),
      senderUsername:
        this.people.find((p) => p.id === senderId)?.username || "Godson",
    });
    this.messages = {
      "11": [
        message(
          "101",
          "11",
          "2",
          "Hey Godson! How is the mobile app coming along?",
          42,
        ),
        message(
          "102",
          "11",
          "1",
          "Making good progress. I want it to feel simple and really easy to use.",
          40,
        ),
        message(
          "103",
          "11",
          "2",
          "That sounds good. Can we test it together later?",
          36,
        ),
        message(
          "104",
          "11",
          "1",
          "Absolutely. Let’s start with sending messages between our phones.",
          34,
        ),
        message("105", "11", "2", "Perfect. I’m free after 4 👋", 2),
      ],
      "12": [
        message(
          "98",
          "12",
          "3",
          "The water-level sensor readings are ready.",
          24,
        ),
      ],
      "13": [
        message("97", "13", "4", "Sent the notes for tomorrow’s session.", 71),
      ],
      "14": [message("96", "14", "5", "Thanks, I’ll check it out!", 130)],
      "15": [
        message("95", "15", "3", "Are we meeting at the lab on Friday?", 190),
      ],
    };
    this.conversations = [
      {
        id: "11",
        type: "DIRECT",
        participant: this.people[0],
        unreadCount: 2,
        lastMessage: this.messages["11"].at(-1)!,
      },
      {
        id: "12",
        type: "GROUP",
        title: "Control Lab",
        memberCount: 5,
        unreadCount: 3,
        lastMessage: this.messages["12"][0],
      },
      {
        id: "13",
        type: "DIRECT",
        participant: this.people[2],
        unreadCount: 0,
        lastMessage: this.messages["13"][0],
      },
      {
        id: "14",
        type: "DIRECT",
        participant: this.people[3],
        unreadCount: 0,
        lastMessage: this.messages["14"][0],
      },
      {
        id: "15",
        type: "DIRECT",
        participant: this.people[1],
        unreadCount: 0,
        lastMessage: this.messages["15"][0],
      },
    ];
  }
  async inbox(): Promise<InboxPage> {
    return {
      conversations: this.conversations.map((c) => ({ ...c })),
      pagination: { hasMore: false, nextCursor: null, limit: 30 },
    };
  }
  async history(id: string): Promise<MessagePage> {
    return {
      messages: [...(this.messages[id] || [])],
      pagination: { hasMore: false, nextCursor: null, limit: 50 },
    };
  }
  async search(query: string) {
    return this.people.filter((p) =>
      p.username.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }
  async direct(user: User) {
    const existing = this.conversations.find(
      (c) => c.participant?.id === user.id,
    );
    if (existing) return existing;
    const conversation: Conversation = {
      id: String(20 + this.conversations.length),
      type: "DIRECT",
      participant: user,
      unreadCount: 0,
      lastMessage: null,
    };
    this.conversations.unshift(conversation);
    return conversation;
  }
  async send(conversationId: string, content: string, clientMessageId: string) {
    const existing = (this.messages[conversationId] || []).find(
      (m) =>
        m.clientMessageId === clientMessageId && m.senderId === this.user.id,
    );
    if (existing) return existing;
    const message: Message = {
      id: String(Date.now()),
      conversationId,
      content,
      clientMessageId,
      senderId: this.user.id,
      createdAt: new Date().toISOString(),
    };
    this.messages[conversationId] = [
      ...(this.messages[conversationId] || []),
      message,
    ];
    this.conversations = this.conversations.map((c) =>
      c.id === conversationId ? { ...c, lastMessage: message } : c,
    );
    this.listeners.forEach((fn) => fn({ type: "message", message }));
    return message;
  }
  async read(conversationId: string) {
    this.conversations = this.conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c,
    );
  }
  subscribe(listener: (event: ChatEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  setActive(active: boolean) {
    if (active) {
      this.listeners.forEach((fn) => {
        fn({ type: "connection", value: "connected" });
        fn({ type: "presence", userIds: ["2", "4"] });
      });
    }
  }
  close() {
    this.listeners.clear();
  }
}
