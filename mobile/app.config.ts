import type { ConfigContext, ExpoConfig } from "expo/config";

const { resolveBuild } = require("./scripts/build-policy.cjs");

export default ({ config }: ConfigContext): ExpoConfig => {
  const build = resolveBuild(process.env);
  return {
    ...config,
    name: build.name,
    slug: "chatsphere-mobile",
    scheme: build.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: build.identifier,
      buildNumber: "1",
    },
    android: {
      ...config.android,
      package: build.identifier,
      versionCode: 1,
      allowBackup: false,
      blockedPermissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.VIBRATE",
      ],
    },
    plugins: [
      ...(config.plugins || []),
      [
        "expo-build-properties",
        {
          ios: { enableSceneSupport: true },
          android: { usesCleartextTraffic: false },
        },
      ],
    ],
  };
};
