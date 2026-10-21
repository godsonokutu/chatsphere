import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import type { ChatClient, Conversation, User } from "../core/types";
import {
  Avatar,
  colors,
  Empty,
  font,
  Icon,
  Notice,
  Search,
  styles,
} from "../ui";

export function PeopleScreen({
  client,
  onOpen,
}: {
  client: ChatClient;
  onOpen: (c: Conversation) => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    setUsers([]);
    if (query.trim().length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void client
        .search(query)
        .then((result) => {
          if (active) setUsers(result);
        })
        .catch((error) => {
          if (active) setError(error.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, query]);
  async function open(user: User) {
    if (opening) return;
    setOpening(user.id);
    setError("");
    try {
      const conversation = await client.direct(user);
      if (alive.current) onOpen(conversation);
    } catch (error) {
      if (alive.current) setError((error as Error).message);
    } finally {
      if (alive.current) setOpening("");
    }
  }
  return (
    <View style={styles.screen}>
      <View style={[styles.page, { paddingTop: 30, gap: 16 }]}>
        <Text style={styles.eyebrow}>A CONVERSATION AWAY</Text>
        <Text style={styles.title}>
          Find your people<Text style={{ color: colors.blue }}>.</Text>
        </Text>
        <Text style={{ ...styles.body, marginBottom: 6 }}>
          Search for a ChatSphere username to say hello.
        </Text>
        <Search
          value={query}
          onChangeText={setQuery}
          placeholder="Search usernames"
        />
      </View>
      {!!error && <Notice text={error} />}
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.blue} style={{ marginTop: 55 }} />
          ) : (
            <Empty
              icon="people-outline"
              title={
                query.trim().length < 2
                  ? "Good company starts here"
                  : "No people found"
              }
              text={
                query.trim().length < 2
                  ? `Type at least two characters${client.preview ? " — try “Ama” in this preview." : " to search for someone."}`
                  : "Try a different username."
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.username}`}
            disabled={!!opening}
            onPress={() => {
              void open(item);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 18,
              gap: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <Avatar name={item.username} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text
                style={{
                  color: colors.text,
                  fontFamily: font.bold,
                  fontSize: 15,
                }}
              >
                {item.username}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: font.regular,
                  fontSize: 12,
                }}
              >
                Start a conversation
              </Text>
            </View>
            {opening === item.id ? (
              <ActivityIndicator color={colors.blue} />
            ) : (
              <Icon name="arrow-forward" color={colors.blue} size={20} />
            )}
          </Pressable>
        )}
      />
    </View>
  );
}
