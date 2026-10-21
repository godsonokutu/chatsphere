import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { ApiError } from "./core/http";
import { compareIds, mergeInbox, mergeMessages } from "./core/messages";
import type {
  ChatClient,
  Connection,
  Conversation,
  Message,
  Pagination,
} from "./core/types";

export function useChat(client: ChatClient) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [pages, setPages] = useState<Record<string, Pagination>>({});
  const [inboxPage, setInboxPage] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [online, setOnline] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState<string[]>([]);
  const mounted = useRef(true);
  const activeId = useRef<string | null>(null);
  const foreground = useRef(true);
  const seen = useRef(new Set<string>());
  const sends = useRef(new Set<string>());
  const reading = useRef(new Set<string>());
  const historyFlights = useRef(new Set<string>());

  const loadInbox = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const result = await client.inbox(cursor);
        if (!mounted.current) return;
        setConversations((current) =>
          mergeInbox(current, result.conversations),
        );
        setInboxPage(result.pagination);
        setError("");
      } catch (error) {
        if (mounted.current) setError((error as Error).message);
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [client],
  );

  const loadHistory = useCallback(
    async (id: string, before?: string) => {
      const key = `${id}:${before || "latest"}`;
      if (historyFlights.current.has(key)) return;
      historyFlights.current.add(key);
      setHistoryLoading(true);
      try {
        const result = await client.history(id, before);
        if (!mounted.current) return;
        result.messages.forEach((m) => seen.current.add(m.id));
        setMessages((current) => {
          const latest = result.messages.at(-1);
          // Reconnect can miss more than one page. Reopen the latest contiguous
          // server window instead of silently joining disjoint history ranges.
          const retained = before
            ? current[id] || []
            : (current[id] || []).filter(
                (m) =>
                  m.localStatus || (latest && compareIds(m.id, latest.id) > 0),
              );
          return { ...current, [id]: mergeMessages(retained, result.messages) };
        });
        setPages((current) => ({ ...current, [id]: result.pagination }));
        setDenied((current) => current.filter((value) => value !== id));
        setError("");
      } catch (error) {
        if (!mounted.current) return;
        if (error instanceof ApiError && [403, 404].includes(error.status)) {
          setMessages((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
          setConversations((current) => current.filter((c) => c.id !== id));
          setDenied((current) => [...current, id]);
        }
        setError((error as Error).message);
      } finally {
        historyFlights.current.delete(key);
        if (mounted.current) setHistoryLoading(historyFlights.current.size > 0);
      }
    },
    [client],
  );

  const receive = useCallback(
    (message: Message) => {
      const duplicate = seen.current.has(message.id);
      seen.current.add(message.id);
      setMessages((current) => ({
        ...current,
        [message.conversationId]: mergeMessages(
          current[message.conversationId] || [],
          [message],
        ),
      }));
      setConversations((current) => {
        return mergeInbox(
          [],
          current.map((c) =>
            c.id === message.conversationId
              ? {
                  ...c,
                  lastMessage:
                    !c.lastMessage ||
                    compareIds(message.id, c.lastMessage.id) >= 0
                      ? message
                      : c.lastMessage,
                  unreadCount:
                    c.unreadCount +
                    (!duplicate && message.senderId !== client.user.id ? 1 : 0),
                }
              : c,
          ),
        );
      });
    },
    [client, loadInbox],
  );

  const send = useCallback(
    async (conversationId: string, content: string, retry?: Message) => {
      const clientMessageId = retry?.clientMessageId || Crypto.randomUUID();
      if (sends.current.has(clientMessageId)) return;
      sends.current.add(clientMessageId);
      const pending: Message = retry || {
        id: `local-${clientMessageId}`,
        conversationId,
        clientMessageId,
        content,
        createdAt: new Date().toISOString(),
        senderId: client.user.id,
      };
      setMessages((current) => ({
        ...current,
        [conversationId]: mergeMessages(current[conversationId] || [], [
          { ...pending, localStatus: "sending", failure: undefined },
        ]),
      }));
      try {
        const message = await client.send(
          conversationId,
          content,
          clientMessageId,
        );
        if (mounted.current) receive(message);
      } catch (error) {
        if (mounted.current)
          setMessages((current) => ({
            ...current,
            [conversationId]: mergeMessages(current[conversationId] || [], [
              {
                ...pending,
                localStatus: "failed",
                failure: (error as Error).message,
              },
            ]),
          }));
      } finally {
        sends.current.delete(clientMessageId);
      }
    },
    [client, receive],
  );

  const markRead = useCallback(
    async (id: string, messageId: string) => {
      const key = `${id}:${messageId}`;
      if (!foreground.current || reading.current.has(key)) return;
      reading.current.add(key);
      try {
        await client.read(id, messageId);
        if (mounted.current)
          setConversations((current) =>
            current.map((c) =>
              c.id === id &&
              (!c.lastMessage || compareIds(c.lastMessage.id, messageId) <= 0)
                ? { ...c, unreadCount: 0 }
                : c,
            ),
          );
      } catch {
        reading.current.delete(key);
      }
    },
    [client],
  );

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = client.subscribe((event) => {
      if (event.type === "connection") setConnection(event.value);
      if (event.type === "presence") setOnline(event.userIds);
      if (event.type === "message") {
        receive(event.message);
        void loadInbox();
      }
      if (event.type === "read" && event.userId === client.user.id)
        void loadInbox();
      if (event.type === "sync") {
        void loadInbox();
        if (activeId.current) void loadHistory(activeId.current);
      }
    });
    void loadInbox();
    client.setActive(true);
    const subscription = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active";
      client.setActive(state === "active");
      if (state === "active") {
        void loadInbox();
        if (activeId.current) void loadHistory(activeId.current);
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      unsubscribe();
      client.close();
    };
  }, [client, loadHistory, loadInbox, receive]);

  return {
    conversations,
    messages,
    pages,
    inboxPage,
    loading,
    historyLoading,
    connection,
    online,
    error,
    denied,
    clearError: () => setError(""),
    loadInbox,
    loadHistory,
    send,
    markRead,
    select: (id: string | null) => {
      activeId.current = id;
    },
    addConversation: (conversation: Conversation) =>
      setConversations((current) => mergeInbox(current, [conversation])),
  };
}
export type ChatState = ReturnType<typeof useChat>;
