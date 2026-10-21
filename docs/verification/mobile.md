# Mobile verification — 21 October 2026

Source baseline: `1201b585864bf99d7a56bb261b2050d3ce934337` from `godsonokutu/chatsphere/main`.

Environment: Windows 11, Node.js 24.14.1, npm 11.11.0. Mobile dependencies are committed in `mobile/package-lock.json`. Expo SDK 57 / React Native 0.86.3 / React 19.2.3 were selected from the official SDK 57 template and Expo's bundled dependency map. The server lock also includes SMTP capture and MIME parsing development dependencies for the integration suite.

## Automated checks

| Check | Result | What it proves |
| --- | --- | --- |
| Mobile `npm run typecheck` | PASS | Strict TypeScript checks across the app |
| Mobile `npm test` | PASS, 18 tests | Session/token coordination, local sign-out, retries, bigint-safe IDs, URL policy and native variant build gates |
| Mobile `npm run export:web` | PASS | Production browser JavaScript bundle, with four font/icon assets |
| Mobile `npm run export:native` | PASS | Android and iOS JavaScript/Hermes bundles; no native binary or signing |
| Server `npm run check:syntax` | PASS, 85 files | Syntax only, including the integration runner |
| Server `npm run test:smoke` | PASS, 1 test | Existing real isolated health-router response contract |
| Server `npm run test:mobile` | PASS, 4 tests | Real HTTP/controller transport, injected auth-service boundary |
| Server `npm run test:integration` | PASS, 16 checks | Real MySQL, API/Socket.IO, mobile JavaScript adapters and authenticated TLS SMTP capture |

The session tests cover one refresh flight for concurrent requests; delayed 401 responses after successful rotation; refresh-token persistence; offline restoration without deleting a valid saved secret; explicit revoked-session handling; storage failure; sign-out during a pending refresh; and accurate reporting of unconfirmed server revocation during offline sign-out.

Message tests cover reconciliation of an optimistic timeout retry with a confirmed server message; duplicate acknowledgements; a late timeout after confirmation; sender/conversation boundaries; IDs above `Number.MAX_SAFE_INTEGER`; and old inbox responses arriving after newer realtime previews.

The mobile auth HTTP tests mount the actual new controller factory with an injected service. They check the returned token field allowlist, body-token transport without cookie fallback, cache prevention, error propagation and invalid-input responses. They do not claim that credential verification, database rotation, reuse detection or real revocation has been executed. The production controller delegates those decisions to the existing auth service.

## Browser UI checks

The exported application was served on loopback and inspected in the browser at 320 × 700 and 390 × 844, with an additional overflow check at the iPhone 11 CSS size of 414 × 896. This executes React Native Web, not UIKit or Android native views.

- Opened the explicit sample preview; sample-data banner remains visible.
- Checked inbox layout and scrolling, group filter and conversation search.
- Searched a sample username and opened the matching direct conversation.
- Opened a message thread and sent a local sample message; the composer cleared and one confirmed message appeared.
- Confirmed the conversation's unread count cleared after opening/read acknowledgement in preview mode.
- Inspected the narrow layout and corrected header/button crowding at 320px.
- Checked profile/leave-preview navigation and the unauthenticated screen.

Screenshots: [320px inbox](mobile-screenshots/inbox-320.png), [390px inbox](mobile-screenshots/inbox-390.png), [390px thread](mobile-screenshots/thread-390.png). All data in those screenshots is explicit sample data.

## Real-service integration continuation

The continuation starts from mobile commit `8e7e0228410d26d4bc9cf55a1dbdcbf16baf709c`. [`server/test/integration/run.cjs`](../../server/test/integration/run.cjs) starts the real API, executes all ten migrations against a fresh MySQL 8 database, and runs the actual mobile `Session` and `LiveClient` JavaScript adapters. It uses synthetic accounts and an authenticated TLS SMTP capture server. There are no auth-service, repository, socket or mail-transport replacements in this suite.

The [machine-readable report](mobile-integration.json) records the checks, versions and results. The checks cover encrypted-outbox email verification; password hashing; direct/group messaging and MySQL persistence; delivery/read receipts; lost-acknowledgement retries and conflicting retry content; HTTP/socket authorization; removal from a group; foreign-key enforcement; API restart and reconnect; browser-cookie/native transport separation; refresh concurrency, stale-token grace, replay detection and revocation; and logout on already-connected sockets.

The expiry check signs one short-lived access JWT using the run's own ephemeral test key and a real database-backed session, then exercises the production socket-expiry scheduler and actual mobile refresh/reconnect logic. It does not shorten the production login TTL policy. SecureStore is represented by in-memory device storage in this Node-based suite, so native Keychain/Keystore behavior is still unverified.

The runner generates its own database, account and signing material, starts the API on loopback, trusts only its temporary SMTP CA in that API child process, and cleans up its own resources. It does not read or modify the installed MySQL service's data directory. CI uses a dedicated disposable MySQL container instead. See [run instructions](../../server/test/integration/README.md).

## Remaining release gates

1. Verify delivery to outside inboxes with the selected real email provider, including provider authentication and operational limits.
2. Exercise actual browser-to-phone and phone-to-phone UI flows against the configured API. JavaScript adapter integration does not establish native UI behavior.
3. Test native SecureStore persistence/failure, iOS Keychain behavior, actual keyboard interaction, safe areas, text scaling, background/foreground changes, network transitions and access-token expiry on physical Android and iPhone devices.
4. Configure owner-controlled production signing and physical-iPhone provisioning. Native preview compilation/UI results are recorded separately below; no production APK/IPA or store release is claimed.

Only generated credentials for disposable test services are used. No production service was deployed. GitHub Actions results must be inspected separately for the resulting commit; local results are not evidence of a completed hosted run.

## Native build continuation

The `Native preview` workflow compiles a self-contained Android preview APK and
an unsigned iOS simulator app, then exercises the native sample UI using
Android UI Automator and Apple XCUITest. The flow
opens a conversation, enters/sends a sample message, navigates to the profile,
leaves preview and relaunches the app. CI uploads compiler logs, Android JUnit/iOS XCTest results,
screenshots and installer integrity evidence. Inspect the actual run result;
the presence of this workflow does not prove a native build has passed.

Local native generation confirmed the preview Android identifier, disabled
cleartext traffic and backup, and removed unused recording/storage/overlay/
vibration permissions. SDK-matched `expo-system-ui` enables the configured dark
system appearance. SDK 57's opt-in iOS scene support is configured through
`expo-build-properties`; the iOS job must establish native compilation.

Production/staging configuration now rejects missing or placeholder HTTPS API
addresses before compilation and removes the sample-preview action. Preview
has a separate installed identity and never creates a live session. Four new
build-policy tests passed, bringing the mobile suite to 18 tests. No saved Expo
login or Expo token was present; physical-iPhone signing still requires an
owner-controlled account/team. See [build guide](../../mobile/BUILDING.md) and
[dependency review](mobile-dependencies.md).
