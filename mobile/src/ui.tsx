import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export const colors = {
  bg: "#0D1119",
  surface: "#171D29",
  elevated: "#202938",
  line: "#293243",
  text: "#F5F7FC",
  muted: "#98A6BD",
  faint: "#6F7E95",
  blue: "#8AB5FF",
  primary: "#397DF2",
  green: "#67DDB1",
  danger: "#FF9B9B",
};
export const font = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  bold: "DMSans_700Bold",
};
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function IconButton({
  name,
  label,
  onPress,
  style,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        style,
        pressed && { opacity: 0.65 },
      ]}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Avatar({
  name,
  size = 54,
  group,
  online,
}: {
  name: string;
  size?: number;
  group?: boolean;
  online?: boolean;
}) {
  const tones = [
    ["#293E5F", "#A4C7FF"],
    ["#3A304D", "#C8B0EC"],
    ["#29463F", "#A6DDCE"],
    ["#483B30", "#E8C8A5"],
  ];
  const [bg, fg] =
    tones[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % tones.length];
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.36,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {group ? (
          <Icon name="people-outline" color={fg} size={size * 0.45} />
        ) : (
          <Text
            style={{ fontFamily: font.bold, color: fg, fontSize: size * 0.34 }}
          >
            {name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </Text>
        )}
      </View>
      {online && (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.green,
            borderWidth: 3,
            borderColor: colors.bg,
          }}
        />
      )}
    </View>
  );
}
export function Button({
  children,
  onPress,
  loading,
  disabled,
  secondary,
}: {
  children: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
        },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.buttonText}>{children}</Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel || label}
        placeholderTextColor={colors.faint}
        selectionColor={colors.blue}
        style={[styles.field, props.style]}
      />
    </View>
  );
}
export function Search({
  value,
  onChangeText,
  placeholder = "Search conversations",
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.search}>
      <Icon name="search-outline" size={20} color={colors.faint} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="none"
        placeholderTextColor={colors.faint}
        style={styles.searchInput}
      />
      {value !== "" && (
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          onPress={() => onChangeText("")}
          hitSlop={10}
        >
          <Icon name="close-circle" size={20} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}
export function Empty({
  title,
  text,
  icon = "chatbubbles-outline",
}: {
  title: string;
  text: string;
  icon?: IconName;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} color={colors.blue} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
export function Notice({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss?: () => void;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Icon name="information-circle-outline" size={19} color={colors.danger} />
      <Text style={styles.noticeText}>{text}</Text>
      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          accessibilityLabel="Dismiss notice"
          hitSlop={10}
        >
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}
export function timeOf(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 24 },
  eyebrow: {
    color: colors.faint,
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 2.3,
  },
  title: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 34,
    letterSpacing: -1.2,
  },
  body: {
    color: colors.muted,
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  buttonText: { fontFamily: font.bold, color: colors.text, fontSize: 15 },
  label: { fontFamily: font.medium, color: colors.muted, fontSize: 12 },
  field: {
    fontFamily: font.regular,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  search: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    minHeight: 49,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
    minHeight: 49,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 55,
    gap: 12,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontFamily: font.bold, color: colors.text, fontSize: 19 },
  emptyText: {
    fontFamily: font.regular,
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  notice: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 14,
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: "#2F242D",
    borderRadius: 12,
  },
  noticeText: {
    flex: 1,
    color: "#F5C5CB",
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 19,
  },
});
