import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Session } from "../core/session";
import type { Transport } from "../core/http";
import { ApiError } from "../core/http";
import { Button, colors, Field, font, Icon, Notice, styles } from "../ui";

export function AuthScreen({
  session,
  transport,
  configurationError,
  onPreview,
}: {
  session: Session | null;
  transport: Transport | null;
  configurationError: string;
  onPreview?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [identity, setIdentity] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const changeMode = (next: typeof mode) => {
    setMode(next);
    setError("");
    setSuccess("");
  };
  async function submit() {
    if (!session || !transport || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (mode === "login") {
        await session.login(identity, password);
        setPassword("");
      }
      if (mode === "register") {
        await transport("/auth/register", {
          method: "POST",
          body: { username: username.trim(), email: identity.trim(), password },
        });
        setPassword("");
        setMode("verify");
        setSuccess("Check your email for your verification code.");
      }
      if (mode === "verify") {
        await transport("/auth/verify", {
          method: "POST",
          body: { email: identity.trim(), code: code.trim() },
        });
        setMode("login");
        setCode("");
        setSuccess("Account verified. You can sign in now.");
      }
    } catch (error) {
      setError((error as Error).message);
      if (
        error instanceof ApiError &&
        error.code === "ACCOUNT_NOT_VERIFIED" &&
        identity.includes("@")
      )
        setMode("verify");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!transport || busy) return;
    setBusy(true);
    setError("");
    try {
      await transport("/auth/resend-verification", {
        method: "POST",
        body: { email: identity.trim() },
      });
      setSuccess("If verification is required, a new code will be sent.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const disabled =
    !session ||
    !identity.trim() ||
    (mode === "verify" ? !code.trim() : password.length < 8) ||
    (mode === "register" && username.trim().length < 3);
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 28,
          paddingTop: 36,
          paddingBottom: 30,
          flexGrow: 1,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
            marginBottom: 48,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              backgroundColor: colors.primary,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="chatbubbles" size={23} />
          </View>
          <Text
            style={{
              fontFamily: font.bold,
              color: colors.text,
              fontSize: 21,
              letterSpacing: -0.5,
            }}
          >
            ChatSphere<Text style={{ color: colors.blue }}>.</Text>
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            marginBottom: 15,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.green,
            }}
          />
          <Text style={styles.eyebrow}>GOOD CONVERSATIONS START HERE</Text>
        </View>
        <Text
          style={{
            ...styles.title,
            fontSize: 42,
            lineHeight: 47,
            marginBottom: 16,
          }}
        >
          {mode === "register"
            ? "Make yourself\nat home."
            : mode === "verify"
              ? "One small step.\nYou’re almost in."
              : "Your people.\nA little closer."}
        </Text>
        <Text style={{ ...styles.body, marginBottom: 30, maxWidth: 300 }}>
          {mode === "register"
            ? "Create an account and keep your conversations together."
            : mode === "verify"
              ? "Enter the verification code sent to your email."
              : "Pick up where you left off. Sign in to your ChatSphere account."}
        </Text>
        <View style={{ gap: 18 }}>
          {mode === "register" && (
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              maxLength={30}
              autoCapitalize="none"
              placeholder="Your name on ChatSphere"
              autoComplete="username"
            />
          )}
          <Field
            label={mode === "login" ? "Email or phone number" : "Email address"}
            value={identity}
            onChangeText={setIdentity}
            maxLength={254}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            placeholder="you@example.com"
          />
          {mode === "verify" ? (
            <Field
              label="Verification code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="Enter your code"
              onSubmitEditing={() => {
                void submit();
              }}
            />
          ) : (
            <View style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ ...styles.label }}>Password</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={10}
                >
                  <Text
                    style={{
                      fontFamily: font.medium,
                      color: colors.blue,
                      fontSize: 12,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
              <Field
                label=""
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                maxLength={128}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                placeholder={
                  mode === "register"
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                onSubmitEditing={() => {
                  void submit();
                }}
              />
            </View>
          )}
          {!!error && <Notice text={error} />}
          {!!success && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ ...styles.body, color: colors.green }}
            >
              {success}
            </Text>
          )}
          {!!configurationError && (
            <Text style={{ ...styles.body, fontSize: 12 }}>
              {configurationError}
            </Text>
          )}
          <Button
            loading={busy}
            disabled={disabled}
            onPress={() => {
              void submit();
            }}
          >
            {mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : "Verify account"}
          </Button>
          {mode === "verify" && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                void resend();
              }}
              style={{ alignItems: "center", padding: 6 }}
            >
              <Text style={{ color: colors.blue, fontFamily: font.medium }}>
                Send a new code
              </Text>
            </Pressable>
          )}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 5,
            marginTop: 24,
          }}
        >
          <Text style={styles.body}>
            {mode === "login" ? "New around here?" : "Already have an account?"}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => changeMode(mode === "login" ? "register" : "login")}
          >
            <Text
              style={{
                ...styles.body,
                fontFamily: font.bold,
                color: colors.blue,
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, minHeight: 30 }} />
        {!!onPreview && (
          <>
            <View
              style={{
                height: 1,
                backgroundColor: colors.line,
                marginBottom: 22,
                marginTop: 25,
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={onPreview}
              testID="explore-preview"
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 9,
                minHeight: 44,
              }}
            >
              <Icon name="sparkles-outline" size={17} color={colors.blue} />
              <Text
                style={{
                  color: colors.blue,
                  fontFamily: font.medium,
                  fontSize: 14,
                }}
              >
                Explore the mobile preview
              </Text>
              <Icon name="arrow-forward" size={17} color={colors.blue} />
            </Pressable>
            <Text
              style={{
                color: colors.faint,
                textAlign: "center",
                fontFamily: font.regular,
                fontSize: 11,
                marginTop: 6,
              }}
            >
              Sample conversations. No account needed.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
