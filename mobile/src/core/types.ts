export type User = {
  id: string;
  username: string;
  email?: string | null;
  phoneNumber?: string | null;
};
export type Pagination = {
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
};
export type Message = {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderUsername?: string | null;
  clientMessageId: string;
  content: string | null;
  createdAt: string;
  deletedAt?: string | null;
  type?: string;
  localStatus?: "sending" | "failed";
  failure?: string;
};
export type Conversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  title?: string | null;
  participant?: User;
  memberCount?: number;
  unreadCount: number;
  lastMessage: Pick<
    Message,
    "id" | "content" | "createdAt" | "senderId"
  > | null;
};
export type InboxPage = {
  conversations: Conversation[];
  pagination: Pagination;
};
export type MessagePage = { messages: Message[]; pagination: Pagination };
export type Connection = "connecting" | "connected" | "offline";
export type ChatEvent =
  | { type: "connection"; value: Connection }
  | { type: "message"; message: Message }
  | { type: "read"; conversationId: string; userId: string }
  | { type: "presence"; userIds: string[] }
  | { type: "sync" };
export interface ChatClient {
  user: User;
  preview: boolean;
  inbox(cursor?: string): Promise<InboxPage>;
  history(conversationId: string, before?: string): Promise<MessagePage>;
  search(query: string): Promise<User[]>;
  direct(user: User): Promise<Conversation>;
  send(
    conversationId: string,
    content: string,
    clientMessageId: string,
  ): Promise<Message>;
  read(conversationId: string, messageId: string): Promise<void>;
  subscribe(listener: (event: ChatEvent) => void): () => void;
  setActive(active: boolean): void;
  close(): void;
}
