# Native builds and release gates

The `Native preview` workflow compiles actual native projects and exercises the
sample interface with Android UI Automator on an emulator and Apple XCUITest
on an iOS simulator. Inspect
the run attached to the commit before treating any build or test as passed.
The existing `Verify` workflow independently tests the real backend and mobile
JavaScript adapters.

## Installers and identities

| Variant | Installed name / identifier suffix | Behavior |
| --- | --- | --- |
| development (default) | ChatSphere Development / `.development` | Expo Go/local development; live API or explicit preview |
| preview | ChatSphere Preview / `.preview` | Sample data only; never opens a live session |
| staging | ChatSphere Staging / `.staging` | Live API only; configured HTTPS URL required |
| production | ChatSphere / no suffix | Live API only; configured HTTPS URL required |

All identifiers start with `dev.godsonokutu.chatsphere`. Separate identifiers
also separate platform secure-storage namespaces. Preview cannot overwrite an
installed production app. Its messages are temporary sample data.

The Android workflow uploads `ChatSphere-Android-Preview`, containing a
self-contained APK, SHA-256 checksum and signing-certificate evidence. The APK
uses the generated Android **debug certificate**, even though its JavaScript is
bundled in a Release build. It is for testing, not Play Store submission or
production use. No Metro server, API, account or EAS login is needed to use it.
The APK includes arm64 and x86_64; 32-bit-only phones are not included.

The iOS workflow uploads `ChatSphere-iOS-Simulator`, containing an unsigned
Intel (x86_64) simulator `.app` archive and checksum. **It cannot be installed
on an iPhone or an ARM-only simulator.**
Download and extract it on a Mac, then install into a booted simulator using
`xcrun simctl install booted path/to/ChatSpherePreview.app`.

Build logs, Android JUnit results and iOS XCTest results/screenshots are
separate evidence artifacts.
An uploaded installer establishes compilation; inspect the UI job result to
establish whether the smoke flow passed. GitHub artifact retention is 30 days.

## Local builds

Install Node 24 and the native platform tools. Android requires JDK 17 and the
SDK/NDK versions selected by Expo's generated Gradle project. iOS requires a
supported Mac, Xcode and CocoaPods. This Windows workspace has neither an
Android SDK nor Xcode; CI supplies those tools.

```powershell
cd mobile
npm ci
$env:EXPO_PUBLIC_APP_VARIANT = 'preview'
$env:EXPO_NO_DOTENV = '1'
npx expo prebuild --platform android
cd android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```

The generated project uses a debug signing key by default. Do not upload this
APK as a production release. Generated `android/` and `ios/` directories stay
out of Git; config plugins and the committed lock file reproduce them.

`npm run android` / `npm run ios` compile local native development builds and
require the corresponding platform tools. `npm start` retains the Expo Go
development workflow.

## EAS signing and physical phones

`eas.json` includes preview APK, iOS simulator, staging and production profiles.
After signing into your own Expo account, initialize/link the intended project
with EAS and confirm the application identifiers. There is deliberately no
invented Expo project ID, signing key, Apple team or provisioning profile.

```powershell
# Requires your own configured Expo project and credentials.
npx eas-cli build --platform android --profile preview
# Physical iPhone build requires an Apple Developer team and registered device.
npx eas-cli build --platform ios --profile preview
```

Staging/production builds require `EXPO_PUBLIC_API_URL` in the selected EAS
environment and locally while EAS evaluates app config. It must be a valid
HTTPS URL ending in `/api`; placeholder, embedded-credential and loopback URLs
are rejected. This is a configuration check, not a reachability or deployment
test. API addresses are public bundle data. Database/password/signing/mail
secrets must never be put in `EXPO_PUBLIC_*` variables.

SDK 57's `expo-build-properties` scene support is enabled for the iOS 27 SDK,
using Expo's supported SDK 57 Swift AppDelegate path. See the [official
property](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/#pluginconfigtypeios).
The CI log records the actual Xcode and simulator versions used; this does not
establish behavior on every iOS version or on a physical iPhone.

## Gates that builds cannot satisfy

- A deployed HTTPS API, production MySQL and an authenticated email provider,
  with verification delivered to an outside inbox.
- Native SecureStore/Keychain persistence and failure behavior through actual
  login, process restart, logout and reinstall. Sample-only UI tests do not
  exercise a saved live session.
- Physical Android/iPhone keyboard, safe-area, accessibility, background and
  network-transition tests; browser-to-phone and phone-to-phone live UI flows.
- Owner-controlled production signing, provisioning and store review.

Calls, attachments, push notifications, group administration and durable
offline sending are not part of this text-messaging MVP.
