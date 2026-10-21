import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { titleOf } from "../core/messages";
import type { Conversation, User } from "../core/types";
import type { ChatState } from "../useChat";
import {
  Avatar,
  colors,
  Empty,
  font,
  Icon,
  IconButton,
  Search,
  styles,
  timeOf,
} from "../ui";

export function InboxScreen({
  chat,
  user,
  onOpen,
  onNew,
  onProfile,
}: {
  chat: ChatState;
  user: User;
  onOpen: (c: Conversation) => void;
  onNew: () => void;
  onProfile: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const { width } = useWindowDimensions();
  const unread = chat.conversations.filter((c) => c.unreadCount > 0).length;
  const list = chat.conversations.filter(
    (c) =>
      titleOf(c).toLowerCase().includes(query.toLowerCase()) &&
      (filter !== "Unread" || c.unreadCount > 0) &&
      (filter !== "Groups" || c.type === "GROUP"),
  );
  return (
    <View style={styles.screen}>
      <View style={[styles.page, { paddingTop: 24, gap: 22 }]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
            <Icon name="chatbubbles" size={16} color={colors.blue} />
            <Text style={styles.eyebrow}>CHATSPHERE</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            onPress={onProfile}
          >
            <Avatar name={user.username} size={36} />
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { fontSize: width < 380 ? 27 : 32 }]}>
              Conversations<Text style={{ color: colors.blue }}>.</Text>
            </Text>
            <Text style={{ ...styles.body, marginTop: 4 }}>
              {unread
                ? `${unread} ${unread === 1 ? "conversation" : "conversations"} waiting for you`
                : "A good day to stay in touch"}
            </Text>
          </View>
          <IconButton
            name="create-outline"
            label="New conversation"
            onPress={onNew}
            style={{ backgroundColor: "#21314C" }}
          />
        </View>
        <Search value={query} onChangeText={setQuery} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          {["All", "Unread", "Groups"].map((name) => (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === name }}
              onPress={() => setFilter(name)}
              style={{
                paddingHorizontal: 17,
                paddingVertical: 9,
                borderRadius: 12,
                backgroundColor: filter === name ? "#D7E5FF" : colors.surface,
                flexDirection: "row",
                gap: 7,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: font.bold,
                  color: filter === name ? "#1A2F51" : colors.muted,
                  fontSize: 12,
                }}
              >
                {name}
              </Text>
              {name === "Unread" && unread > 0 && (
                <Text
                  style={{
                    fontFamily: font.bold,
                    color: filter === name ? "#1A2F51" : colors.blue,
                    fontSize: 11,
                  }}
                >
                  {unread}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 20,
          flexGrow: 1,
        }}
        refreshing={chat.loading}
        onRefresh={() => {
          void chat.loadInbox();
        }}
        ListEmptyComponent={
          chat.loading ? (
            <ActivityIndicator color={colors.blue} style={{ margin: 60 }} />
          ) : (
            <Empty
              title={
                query || filter !== "All"
                  ? "Nothing here yet"
                  : "Say the first hello"
              }
              text={
                query || filter !== "All"
                  ? "Try another search or conversation filter."
                  : "Find someone in People and start a conversation."
              }
            />
          )
        }
        ListFooterComponent={
          chat.inboxPage?.hasMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void chat.loadInbox(chat.inboxPage?.nextCursor || undefined);
              }}
              style={{ padding: 20, alignItems: "center" }}
            >
              <Text style={{ color: colors.blue, fontFamily: font.medium }}>
                Load more conversations
              </Text>
            </Pressable>
          ) : list.length > 0 ? (
            <View style={{ alignItems: "center", paddingTop: 30, gap: 8 }}>
              <View
                style={{ width: 28, height: 2, backgroundColor: colors.line }}
              />
              <Text
                style={{
                  fontFamily: font.regular,
                  color: colors.faint,
                  fontSize: 11,
                }}
              >
                You’re all caught up here.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const name = titleOf(item);
          return (
            <Pressable
              accessibilityRole="button"
                testID={`conversation-${item.id}`}
              accessibilityLabel={`${name}, ${item.unreadCount} unread messages`}
              onPress={() => onOpen(item)}
              style={({ pressed }) => ({
                flexDirection: "row",
                paddingVertical: 18,
                gap: 14,
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: "#1B2330",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Avatar
                name={name}
                group={item.type === "GROUP"}
                online={
                  !!item.participant &&
                  chat.online.includes(item.participant.id)
                }
              />
              <View style={{ flex: 1, gap: 7 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontFamily: font.bold,
                      fontSize: 15,
                    }}
                  >
                    {name}
                  </Text>
                  <Text
                    style={{
                      color: item.unreadCount > 0 ? colors.blue : colors.faint,
                      fontFamily: font.medium,
                      fontSize: 10,
                    }}
                  >
                    {timeOf(item.lastMessage?.createdAt)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: item.unreadCount > 0 ? "#D3DDED" : colors.muted,
                      fontFamily:
                        item.unreadCount > 0 ? font.medium : font.regular,
                      fontSize: 12.5,
                    }}
                  >
                    {item.lastMessage?.senderId === user.id ? "You: " : ""}
                    {item.lastMessage
                      ? item.lastMessage.content || "Message unavailable"
                      : "Start your conversation"}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View
                      style={{
                        minWidth: 21,
                        height: 21,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.primary,
                        paddingHorizontal: 5,
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontFamily: font.bold,
                          fontSize: 10,
                        }}
                      >
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
