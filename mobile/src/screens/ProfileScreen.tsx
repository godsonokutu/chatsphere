import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { ChatClient } from "../core/types";
import { Avatar, Button, colors, font, Icon, styles } from "../ui";

export function ProfileScreen({
  client,
  onLogout,
}: {
  client: ChatClient;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <ScrollView
      contentContainerStyle={{ padding: 26, paddingTop: 32, flexGrow: 1 }}
    >
      <Text style={styles.eyebrow}>MAKE YOURSELF AT HOME</Text>
      <Text style={{ ...styles.title, marginTop: 15, marginBottom: 32 }}>
        Your space<Text style={{ color: colors.blue }}>.</Text>
      </Text>
      <View
        style={{
          padding: 25,
          backgroundColor: colors.surface,
          borderRadius: 24,
          gap: 20,
        }}
      >
        <Avatar name={client.user.username} size={78} />
        <View style={{ gap: 5 }}>
          <Text
            style={{ color: colors.text, fontFamily: font.bold, fontSize: 24 }}
          >
            {client.user.username}
          </Text>
          <Text style={styles.body}>
            {client.user.email ||
              client.user.phoneNumber ||
              "ChatSphere member"}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon
            name={
              client.preview ? "sparkles-outline" : "phone-portrait-outline"
            }
            size={17}
            color={colors.blue}
          />
          <Text
            style={{
              color: colors.blue,
              fontFamily: font.medium,
              fontSize: 12,
            }}
          >
            {client.preview
              ? "Mobile preview · sample account"
              : "Signed in on this device"}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 30, gap: 12 }}>
        <Text
          style={{ color: colors.text, fontFamily: font.bold, fontSize: 16 }}
        >
          A place for your conversations
        </Text>
        <Text style={styles.body}>
          ChatSphere brings your direct and group conversations together,
          wherever you are.
        </Text>
        {client.preview && (
          <Text style={{ ...styles.body, color: colors.blue }}>
            This preview stays on this device. Messages you send here are sample
            messages.
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minHeight: 45 }} />
      <Button
        secondary
        loading={busy}
        onPress={() => {
          setBusy(true);
          void onLogout().finally(() => setBusy(false));
        }}
      >
        {client.preview ? "Leave preview" : "Sign out"}
      </Button>
      <Text
        style={{
          color: colors.faint,
          fontFamily: font.regular,
          fontSize: 11,
          textAlign: "center",
          marginTop: 20,
        }}
      >
        CHATSPHERE MOBILE · 0.1.0
      </Text>
    </ScrollView>
  );
}
