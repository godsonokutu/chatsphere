import type { Conversation, Message } from "./types.ts";

export function titleOf(conversation: Conversation) {
  return conversation.type === "GROUP"
    ? conversation.title || "Group conversation"
    : conversation.participant?.username || "Unavailable user";
}
export function compareIds(a: string, b: string) {
  return a.length - b.length || a.localeCompare(b);
}

// Preserve bigint IDs as strings and reconcile a timeout retry with its original
// optimistic item. The sender is part of the key; other users can reuse a UUID.
export function mergeMessages(
  current: Message[],
  incoming: Message[],
): Message[] {
  const result = [...current];
  for (const message of incoming) {
    const index = result.findIndex(
      (existing) =>
        existing.conversationId === message.conversationId &&
        (existing.id === message.id ||
          (existing.senderId === message.senderId &&
            existing.clientMessageId === message.clientMessageId)),
    );
    if (index < 0) result.push(message);
    else if (!message.localStatus || result[index].localStatus)
      result[index] = message;
  }
  return result.sort((a, b) => {
    if (!a.localStatus && !b.localStatus) return compareIds(a.id, b.id);
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
}

export function mergeInbox(current: Conversation[], incoming: Conversation[]) {
  const map = new Map(current.map((c) => [c.id, c]));
  for (const conversation of incoming) {
    const previous = map.get(conversation.id);
    map.set(
      conversation.id,
      previous?.lastMessage &&
        conversation.lastMessage &&
        compareIds(previous.lastMessage.id, conversation.lastMessage.id) > 0
        ? { ...conversation, lastMessage: previous.lastMessage }
        : conversation,
    );
  }
  return [...map.values()].sort(
    (a, b) =>
      Date.parse(b.lastMessage?.createdAt || "1970-01-01") -
      Date.parse(a.lastMessage?.createdAt || "1970-01-01"),
  );
}
