import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { titleOf } from "../core/messages";
import type { Conversation, Message, User } from "../core/types";
import type { ChatState } from "../useChat";
import {
  Avatar,
  colors,
  Empty,
  font,
  Icon,
  IconButton,
  styles,
  timeOf,
} from "../ui";

export function ThreadScreen({
  conversation,
  chat,
  user,
  onBack,
}: {
  conversation: Conversation;
  chat: ChatState;
  user: User;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [info, setInfo] = useState(false);
  const messages = chat.messages[conversation.id] || [];
  const data = useMemo(() => [...messages].reverse(), [messages]);
  const name = titleOf(conversation);
  const online =
    !!conversation.participant &&
    chat.online.includes(conversation.participant.id);
  const page = chat.pages[conversation.id];
  const latestIncoming = [...messages]
    .reverse()
    .find((m) => !m.localStatus && m.senderId !== user.id);
  useEffect(() => {
    chat.select(conversation.id);
    void chat.loadHistory(conversation.id);
    return () => chat.select(null);
  }, [conversation.id, chat.loadHistory]);
  useEffect(() => {
    if (latestIncoming && chat.connection === "connected")
      void chat.markRead(conversation.id, latestIncoming.id);
  }, [conversation.id, latestIncoming?.id, chat.markRead, chat.connection]);
  useEffect(() => {
    if (chat.denied.includes(conversation.id)) onBack();
  }, [chat.denied, conversation.id, onBack]);
  function send() {
    const content = draft.trim();
    if (!content || content.length > 4000) return;
    setDraft("");
    void chat.send(conversation.id, content);
  }
  function renderMessage(message: Message, index: number) {
    const mine = message.senderId === user.id;
    const older = data[index + 1];
    const firstForDay =
      !older ||
      new Date(older.createdAt).toDateString() !==
        new Date(message.createdAt).toDateString();
    const date = new Date(message.createdAt);
    return (
      <View>
        {firstForDay && (
          <View style={{ alignItems: "center", marginVertical: 25 }}>
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 9,
                letterSpacing: 1.6,
                color: colors.faint,
              }}
            >
              {date.toDateString() === new Date().toDateString()
                ? "TODAY"
                : date
                    .toLocaleDateString([], { month: "short", day: "numeric" })
                    .toUpperCase()}
            </Text>
          </View>
        )}
        <View
          style={{
            alignItems: mine ? "flex-end" : "flex-start",
            marginBottom: 16,
            paddingHorizontal: 22,
          }}
        >
          {conversation.type === "GROUP" && !mine && (
            <Text
              style={{
                color: colors.blue,
                fontSize: 11,
                fontFamily: font.medium,
                marginBottom: 6,
                marginLeft: 8,
              }}
            >
              {message.senderUsername || "Group member"}
            </Text>
          )}
          <Pressable
            accessibilityRole={
              message.localStatus === "failed" ? "button" : undefined
            }
            accessibilityLabel={
              message.localStatus === "failed"
                ? `Retry message: ${message.content}`
                : undefined
            }
            disabled={message.localStatus !== "failed"}
            onPress={() => {
              void chat.send(conversation.id, message.content || "", message);
            }}
            style={{
              maxWidth: "85%",
              backgroundColor: mine ? "#234E8E" : colors.surface,
              borderRadius: 20,
              borderBottomRightRadius: mine ? 5 : 20,
              borderBottomLeftRadius: mine ? 20 : 5,
              paddingHorizontal: 17,
              paddingVertical: 13,
              borderWidth: 1,
              borderColor:
                message.localStatus === "failed"
                  ? "#975F66"
                  : mine
                    ? "#305A98"
                    : "#242D3B",
            }}
          >
            <Text
              style={{
                fontFamily: font.regular,
                color: message.deletedAt ? colors.muted : colors.text,
                fontSize: 15,
                lineHeight: 23,
              }}
            >
              {message.deletedAt
                ? "Message removed"
                : message.content || "Message unavailable"}
            </Text>
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginTop: 6,
              marginHorizontal: 5,
            }}
          >
            <Text
              style={{
                color:
                  message.localStatus === "failed"
                    ? colors.danger
                    : colors.faint,
                fontFamily: font.regular,
                fontSize: 9,
              }}
            >
              {message.localStatus === "sending"
                ? "Sending…"
                : message.localStatus === "failed"
                  ? "Not confirmed · tap to retry"
                  : timeOf(message.createdAt)}
            </Text>
            {mine && !message.localStatus && (
              <Icon name="checkmark" size={11} color={colors.blue} />
            )}
          </View>
          {message.localStatus === "failed" && (
            <Text
              style={{
                color: colors.danger,
                fontFamily: font.regular,
                fontSize: 10,
                maxWidth: "85%",
                marginTop: 5,
              }}
            >
              {message.failure}
            </Text>
          )}
        </View>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <IconButton
          name="arrow-back"
          label="Back to conversations"
          onPress={onBack}
          style={{ backgroundColor: colors.bg, width: 32 }}
        />
        <Avatar
          name={name}
          size={43}
          group={conversation.type === "GROUP"}
          online={online}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: font.bold, color: colors.text, fontSize: 16 }}
          >
            {name}
          </Text>
          <Text
            style={{
              color: online ? colors.green : colors.muted,
              fontFamily: font.regular,
              fontSize: 11,
            }}
          >
            {conversation.type === "GROUP"
              ? `${conversation.memberCount || "Group"} members`
              : online
                ? "Online now"
                : "Direct conversation"}
          </Text>
        </View>
        <IconButton
          name="ellipsis-horizontal"
          label="Conversation information"
          onPress={() => setInfo(true)}
          style={{ backgroundColor: colors.bg, width: 32 }}
        />
      </View>
      <FlatList
        inverted
        data={data}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => renderMessage(item, index)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 10, flexGrow: 1 }}
        ListEmptyComponent={
          chat.historyLoading ? (
            <ActivityIndicator
              style={{ padding: 60, transform: [{ scaleY: -1 }] }}
              color={colors.blue}
            />
          ) : (
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Empty
                title="A fresh conversation"
                text="Send a hello to get things started."
              />
            </View>
          )
        }
        ListFooterComponent={
          page?.hasMore ? (
            <Pressable
              accessibilityRole="button"
              disabled={chat.historyLoading}
              onPress={() => {
                void chat.loadHistory(
                  conversation.id,
                  page.nextCursor || undefined,
                );
              }}
              style={{ alignItems: "center", padding: 18 }}
            >
              {chat.historyLoading ? (
                <ActivityIndicator color={colors.blue} />
              ) : (
                <Text style={{ color: colors.blue, fontFamily: font.medium }}>
                  Load earlier messages
                </Text>
              )}
            </Pressable>
          ) : null
        }
      />
      <View
        style={{
          paddingHorizontal: 18,
          paddingBottom: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "#1B2330",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <TextInput
            accessibilityLabel="Message"
            placeholder="Write a message…"
            placeholderTextColor={colors.faint}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
            style={{
              flex: 1,
              minHeight: 50,
              maxHeight: 130,
              borderRadius: 19,
              paddingVertical: 14,
              paddingHorizontal: 18,
              backgroundColor: colors.surface,
              color: colors.text,
              fontFamily: font.regular,
              fontSize: 14,
              lineHeight: 21,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !draft.trim() }}
            disabled={!draft.trim()}
            onPress={send}
            style={({ pressed }) => ({
              width: 50,
              height: 50,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: draft.trim() ? colors.primary : colors.elevated,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Icon
              name="arrow-up"
              size={23}
              color={draft.trim() ? "white" : colors.faint}
            />
          </Pressable>
        </View>
        {draft.length >= 3800 && (
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 10,
              color: colors.muted,
              textAlign: "right",
              marginTop: 5,
            }}
          >
            {draft.length}/4000
          </Text>
        )}
      </View>
      <Modal
        visible={info}
        transparent
        animationType="fade"
        onRequestClose={() => setInfo(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close conversation information"
          onPress={() => setInfo(false)}
          style={{
            flex: 1,
            backgroundColor: "#000000AA",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 30,
              gap: 18,
              paddingBottom: 50,
            }}
          >
            <Avatar
              name={name}
              group={conversation.type === "GROUP"}
              size={65}
            />
            <Text style={{ ...styles.title, fontSize: 26 }}>{name}</Text>
            <Text style={styles.body}>
              {conversation.type === "GROUP"
                ? "Group conversation. Group administration is available in the web app."
                : "A direct conversation between you and " + name + "."}
            </Text>
            <Text style={{ color: colors.blue, fontFamily: font.medium }}>
              Tap anywhere to close
            </Text>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
