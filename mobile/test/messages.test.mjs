import test from "node:test";
import assert from "node:assert/strict";
import { mergeMessages, mergeInbox } from "../src/core/messages.ts";

const message = (overrides = {}) => ({
  id: "100",
  conversationId: "1",
  senderId: "1",
  clientMessageId: "same-client-message-id",
  content: "Hello",
  createdAt: "2026-10-21T10:00:00Z",
  ...overrides,
});
test("a confirmed retry replaces the optimistic message without duplication", () => {
  const pending = message({ id: "local-id", localStatus: "failed" });
  const confirmed = message();
  const merged = mergeMessages([pending], [confirmed, confirmed]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "100");
  assert.equal(merged[0].localStatus, undefined);
});
test("a late timeout cannot overwrite a confirmed send", () => {
  const confirmed = message();
  const pending = message({ id: "local-id", localStatus: "failed" });
  assert.deepEqual(mergeMessages([confirmed], [pending]), [confirmed]);
});
test("another sender or conversation using the same client ID stays separate", () => {
  const merged = mergeMessages(
    [message()],
    [
      message({ id: "101", senderId: "2" }),
      message({ id: "102", conversationId: "2" }),
    ],
  );
  assert.equal(merged.length, 3);
});
test("IDs above Number.MAX_SAFE_INTEGER sort without precision loss", () => {
  const merged = mergeMessages(
    [],
    [
      message({ id: "9007199254740993", clientMessageId: "b" }),
      message({ id: "9007199254740992", clientMessageId: "a" }),
    ],
  );
  assert.deepEqual(
    merged.map((m) => m.id),
    ["9007199254740992", "9007199254740993"],
  );
});
test("an old inbox response cannot replace a newer realtime preview", () => {
  const current = {
    id: "1",
    type: "DIRECT",
    unreadCount: 1,
    lastMessage: message({ id: "102" }),
  };
  const stale = {
    ...current,
    lastMessage: message({ id: "101", content: "Old" }),
  };
  assert.equal(mergeInbox([current], [stale])[0].lastMessage.id, "102");
});
