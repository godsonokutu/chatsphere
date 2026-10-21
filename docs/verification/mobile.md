# Mobile verification — 21 October 2026

Source baseline: `1201b585864bf99d7a56bb261b2050d3ce934337` from `godsonokutu/chatsphere/main`.

Environment: Windows 11, Node.js 24.14.1, npm 11.11.0. Mobile dependencies are committed in `mobile/package-lock.json`. Expo SDK 57 / React Native 0.86.3 / React 19.2.3 were selected from the official SDK 57 template and Expo's bundled dependency map. The existing server dependency lock was used without changes.

## Automated checks

| Check | Result | What it proves |
| --- | --- | --- |
| Mobile `npm run typecheck` | PASS | Strict TypeScript checks across the app |
| Mobile `npm test` | PASS, 14 tests | Session/token coordination, local sign-out, retry reconciliation, bigint-safe IDs and API URL policy |
| Mobile `npm run export:web` | PASS | Production browser JavaScript bundle, with four font/icon assets |
| Mobile `npm run export:native` | PASS | Android and iOS JavaScript/Hermes bundles; no native binary or signing |
| Server `npm run check:syntax` | PASS, 84 files | Syntax only, including the two new JavaScript files |
| Server `npm run test:smoke` | PASS, 1 test | Existing real isolated health-router response contract |
| Server `npm run test:mobile` | PASS, 4 tests | Real HTTP/controller transport, injected auth-service boundary |

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

## Remaining release gates

1. Run real MySQL startup, migrations and credential/session tests with the existing backend, including rotation, reuse detection and revocation.
2. Verify SMTP account verification and the notification outbox with a real configured provider.
3. Exercise live browser-to-phone and phone-to-phone messaging, authorization, idempotency under acknowledgement loss, receipts and reconnects against MySQL persistence.
4. Test native SecureStore persistence/failure, iOS Keychain behavior, actual keyboard interaction, safe areas, text scaling, background/foreground changes, network transitions and access-token expiry on physical Android and iPhone devices.
5. Compile/sign Android and iOS binaries with separately configured native tooling or EAS. No APK/IPA, provisioning profile, developer account or store release was created.

No backend credentials were invented, no production service was deployed, and no CI limitation was removed. GitHub Actions results must be inspected separately for the resulting commit; local results are not evidence of a completed hosted run.
