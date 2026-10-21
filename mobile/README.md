# ChatSphere Mobile

An Android and iPhone client for the existing ChatSphere Express/MySQL/Socket.IO backend. Built with React Native, Expo SDK 57 and TypeScript. SDK 57 was selected for the Expo Go physical-device workflow documented by Expo on 21 October 2026.

## Included in this first version

- Dark mobile interface, safe areas, accessible labels, readable message bubbles and keyboard-aware layouts.
- Email/phone sign-in, email registration, code verification and verification resend.
- Direct and existing group conversations, local inbox search, unread/group filters and cursor pagination.
- Username search and starting direct conversations.
- Message history, realtime sends/receives, online presence and read acknowledgements.
- Single-flight refresh, secure native refresh-token storage, in-memory access tokens, restoration and local sign-out.
- Manual retries retain the original `clientMessageId`, including when an acknowledgement times out after a successful server write.
- Reconnect/foreground reloads the latest contiguous history window. Older pages can be loaded again, avoiding silent gaps after a long disconnection.
- A clearly labelled, local-only preview. Preview conversations never become fallback data for a live API failure.

Group creation/administration, calls, attachments, push notifications, message editing/deletion and durable offline messaging are outside this first version. Group administration remains in the web app. Text checks indicate server acknowledgement, not recipient delivery or reading. This app does not provide end-to-end encryption.

## Quick preview on Windows

From the repository root:

```powershell
cd mobile
npm ci
npm run web
```

Open the URL printed by Expo and choose **Explore the mobile preview**. You can filter conversations, search sample usernames such as `Ama`, open chats, send local sample messages and leave the preview. No backend credentials or account are needed for preview mode. A browser session keeps any live refresh token in memory only; it is not a replacement for native secure-storage testing.

## Run on your iPhone or Android phone

1. Install the official Expo Go app. Keep the phone and PC on the same trusted network.
2. Run `npm ci` in `mobile`, then `npm start`.
3. Scan Expo's QR code. On iPhone, use Camera; on Android, use Expo Go.
4. Choose **Explore the mobile preview**, or configure the API for a live account as below.

Expo's current compatibility guidance: <https://docs.expo.dev/get-started/create-a-project/>. If the installed Expo Go no longer supports SDK 57, use a matching development build or upgrade the SDK and run the verification commands again.

## Connect the real backend

The server must include this change's `/api/auth/mobile/login` and `/api/auth/mobile/refresh` routes. They reuse `auth.service` and the browser routes' existing limiter instances. Login/refresh responses contain an explicit refresh token with `Cache-Control: no-store`; they never set or consume the browser refresh cookie. Logout uses the existing bearer-authenticated `/api/auth/logout` endpoint. Web cookie behavior is unchanged.

```powershell
Copy-Item .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `.env` to the real API URL ending in `/api`, then restart Expo. These variables are bundled into the app and are public. Never put database credentials, JWT signing keys, mail credentials or refresh tokens in them.

Release builds require HTTPS. Expo Go development can use a reachable LAN HTTP API, for example `http://192.168.1.10:5000/api`. A physical phone's `localhost` points to the phone. Keep LAN testing on a trusted network and allow only the required development port in Windows Firewall; do not turn the firewall off. Android/iOS standalone builds may require platform-specific development networking configuration for HTTP; use HTTPS for standalone testing.

Start and validate the existing MySQL migrations, backend and SMTP/outbox separately using the root README. Account verification requires a working email provider. No database, email service or public API was provisioned by this change.

## Session and failure behavior

Native refresh tokens use `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); access tokens and message caches stay in memory. No messages or passwords are written to localStorage or AsyncStorage. Network failure during restoration preserves the stored refresh token and offers Retry. Authentication rejection removes it. Native cookies are not used.

Requests share a refresh flight; late 401 responses do not trigger a second rotation after another request refreshed. Sign-out invalidates pending session writes. Offline sign-out removes local credentials, with a notice that server revocation could not be confirmed. Secure-storage failures are surfaced instead of treating an unsaved session as persistent.

Sending is not silently queued offline. A failed or unconfirmed bubble offers a manual retry with the same ID. Pending messages remain in memory during the current session and are lost when the process exits. Restarted apps reload authoritative history from the server. No background delivery guarantee is made.

## Verification

```powershell
npm run typecheck
npm test
npm run export:web
npm run export:native
cd ../server
npm run check:syntax
npm run test:smoke
npm run test:mobile
```

`export:native` creates Android/iOS JavaScript bundles, not installable APK/IPA files. Native compilation, signing, provisioning and app-store submission need separately configured platform tooling and accounts. No EAS project or developer account is assumed.

See [verification evidence](../docs/verification/mobile.md), including the remaining live-service and physical-device gates. Passing these checks is not a production-readiness claim.

## Code map

| Location | Responsibility |
| --- | --- |
| `App.tsx` | Session boundary, preview/live selection and screen navigation |
| `src/core/session.ts` | Refresh coordination, restoration and sign-out |
| `src/core/http.ts` | API transport, request timeout and release URL checks |
| `src/storage.ts` | Native secure refresh-token storage |
| `src/liveClient.ts` | Existing REST/Socket.IO contracts and foreground connections |
| `src/useChat.ts` | Conversation/history state, acknowledgements and retry identity |
| `src/core/messages.ts` | Message reconciliation and bigint-safe ordering |
| `src/previewClient.ts` | Isolated sample-data mode |
| `src/screens/` | Authentication, inbox, people, thread and profile screens |

App identifiers are `dev.godsonokutu.chatsphere`. Confirm availability before store submission. The Windows asset generator at `scripts/generate-assets.ps1` reproduces the bundled app icons.
