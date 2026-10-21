import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { createTransport, validateApiUrl } from "./src/core/http";
import { Session } from "./src/core/session";
import type { ChatClient, Conversation } from "./src/core/types";
import { secretStore } from "./src/storage";
import { LiveClient } from "./src/liveClient";
import { PreviewClient } from "./src/previewClient";
import { useChat } from "./src/useChat";
import { AuthScreen } from "./src/screens/AuthScreen";
import { InboxScreen } from "./src/screens/InboxScreen";
import { PeopleScreen } from "./src/screens/PeopleScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ThreadScreen } from "./src/screens/ThreadScreen";
import {
  Button,
  colors,
  font,
  Icon,
  Notice,
  styles,
  type IconName,
} from "./src/ui";

const emptySnapshot = { status: "signed-out" as const, user: null };
const noSubscribe = () => () => {};
const variant = process.env.EXPO_PUBLIC_APP_VARIANT || "development";
const liveOnly = variant === "production" || variant === "staging";

function ChatApp({
  client,
  onLogout,
}: {
  client: ChatClient;
  onLogout: () => Promise<void>;
}) {
  const chat = useChat(client);
  const [tab, setTab] = useState("Chats");
  const [selected, setSelected] = useState<Conversation | null>(null);
  function open(conversation: Conversation) {
    const existing = chat.conversations.find(
      (item) => item.id === conversation.id,
    );
    chat.addConversation(existing || conversation);
    setSelected(existing || conversation);
  }
  useEffect(() => {
    if (!selected) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelected(null);
      return true;
    });
    return () => listener.remove();
  }, [selected]);
  return (
    <View style={styles.screen}>
      {client.preview && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 9,
            paddingHorizontal: 20,
            paddingVertical: 8,
            backgroundColor: "#182C45",
          }}
        >
          <Icon name="sparkles-outline" size={13} color={colors.blue} />
          <Text
            style={{
              color: colors.blue,
              fontFamily: font.medium,
              fontSize: 10,
            }}
          >
            PREVIEW · SAMPLE CONVERSATIONS
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave preview"
            onPress={() => {
              void onLogout();
            }}
            style={{
              marginLeft: "auto",
              paddingHorizontal: 8,
              minHeight: 28,
              justifyContent: "center",
            }}
          >
            <Icon name="close" size={17} color={colors.blue} />
          </Pressable>
        </View>
      )}
      {!client.preview && chat.connection !== "connected" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            client.setActive(true);
            void chat.loadInbox();
          }}
          style={{
            padding: 10,
            alignItems: "center",
            backgroundColor: "#2B2923",
          }}
        >
          <Text
            style={{ color: "#E4CD99", fontFamily: font.medium, fontSize: 11 }}
          >
            {chat.connection === "connecting"
              ? "Connecting…"
              : "You’re offline · tap to reconnect"}
          </Text>
        </Pressable>
      )}
      {!!chat.error && <Notice text={chat.error} onDismiss={chat.clearError} />}
      {selected ? (
        <ThreadScreen
          key={selected.id}
          conversation={
            chat.conversations.find((c) => c.id === selected.id) || selected
          }
          chat={chat}
          user={client.user}
          onBack={() => setSelected(null)}
        />
      ) : (
        <>
          {tab === "Chats" ? (
            <InboxScreen
              chat={chat}
              user={client.user}
              onOpen={open}
              onNew={() => setTab("People")}
              onProfile={() => setTab("You")}
            />
          ) : tab === "People" ? (
            <PeopleScreen client={client} onOpen={open} />
          ) : (
            <ProfileScreen client={client} onLogout={onLogout} />
          )}
          <View
            style={{
              flexDirection: "row",
              paddingTop: 12,
              paddingBottom: 8,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              backgroundColor: colors.bg,
            }}
          >
            {(
              [
                {
                  name: "Chats",
                  icon: "chatbubbles-outline",
                  active: "chatbubbles",
                },
                { name: "People", icon: "people-outline", active: "people" },
                {
                  name: "You",
                  icon: "person-circle-outline",
                  active: "person-circle",
                },
              ] as { name: string; icon: IconName; active: IconName }[]
            ).map((item) => (
              <Pressable
                key={item.name}
                testID={`tab-${item.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.name }}
                onPress={() => setTab(item.name)}
                style={{ flex: 1, alignItems: "center", gap: 5, minHeight: 45 }}
              >
                <View
                  style={{
                    width: 55,
                    height: 29,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    backgroundColor:
                      tab === item.name ? "#1D304D" : "transparent",
                  }}
                >
                  <Icon
                    name={tab === item.name ? item.active : item.icon}
                    size={21}
                    color={tab === item.name ? colors.blue : colors.faint}
                  />
                </View>
                <Text
                  style={{
                    color: tab === item.name ? colors.blue : colors.faint,
                    fontFamily: font.medium,
                    fontSize: 10,
                  }}
                >
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const setup = useMemo(() => {
    try {
      if (variant === "preview") throw new Error("Sample-only build");
      const apiUrl = validateApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);
      const transport = createTransport(apiUrl);
      return {
        apiUrl,
        transport,
        session: new Session(transport, secretStore),
        error: "",
      };
    } catch {
      return {
        apiUrl: "",
        transport: null,
        session: null,
        error: liveOnly
          ? "This build could not load its server configuration. Please install a correctly configured build."
          : "Live sign-in is not configured in this build. Explore the preview below.",
      };
    }
  }, []);
  const state = useSyncExternalStore(
    setup.session?.subscribe || noSubscribe,
    setup.session?.getSnapshot || (() => emptySnapshot),
  );
  const [preview, setPreview] = useState(false);
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    if (setup.session) void setup.session.restore();
  }, [setup]);
  const client = useMemo(
    () =>
      preview
        ? new PreviewClient()
        : state.user && setup.session
          ? new LiveClient(setup.session, setup.apiUrl)
          : null,
    [preview, state.user?.id, setup],
  );
  async function logout() {
    if (preview) {
      setPreview(false);
      return;
    }
    try {
      const revoked = await setup.session?.logout();
      if (!revoked)
        Alert.alert(
          "Signed out on this phone",
          "The server session could not be revoked. It will expire automatically.",
        );
    } catch {
      setLocalError("Could not remove the saved session. Please try again.");
    }
  }
  const busy =
    (!fontsLoaded && !fontError) || (!preview && state.status === "restoring");
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#080C12" }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 540,
            alignSelf: "center",
            backgroundColor: colors.bg,
          }}
        >
          <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
            <StatusBar style="light" />
            {busy ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                }}
              >
                <ActivityIndicator color={colors.blue} />
                <Text style={styles.body}>Opening ChatSphere…</Text>
              </View>
            ) : client ? (
              <ChatApp
                key={preview ? "preview" : state.user!.id}
                client={client}
                onLogout={logout}
              />
            ) : state.status === "unavailable" ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: 30,
                  gap: 20,
                }}
              >
                <Text style={{ ...styles.title, fontSize: 30 }}>
                  Let’s reconnect.
                </Text>
                <Text style={styles.body}>{state.error}</Text>
                <Button
                  onPress={() => {
                    void setup.session?.restore();
                  }}
                >
                  Try again
                </Button>
                <Button
                  secondary
                  onPress={() => {
                    void setup.session
                      ?.clear()
                      .catch(() =>
                        setLocalError("Could not remove the saved session."),
                      );
                  }}
                >
                  Use another account
                </Button>
              </View>
            ) : (
              <>
                {!!state.error && <Notice text={state.error} />}
                <AuthScreen
                  session={setup.session}
                  transport={setup.transport}
                  configurationError={setup.error}
                  onPreview={liveOnly ? undefined : () => setPreview(true)}
                />
              </>
            )}
            {!!localError && (
              <Notice text={localError} onDismiss={() => setLocalError("")} />
            )}
          </SafeAreaView>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
