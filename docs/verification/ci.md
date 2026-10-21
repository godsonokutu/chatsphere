# CI verification evidence

Base examined: `5c40c36397972c7a5655ff234514fc34079fd0c0`.
Local verification: 2026-10-05, Linux, Node.js v24.19.0 / npm 11.9.0.
Both packages installed successfully from committed locks with `npm ci --no-audit --no-fund`.

| Check | Local result | Scope |
| --- | --- | --- |
| Client `npm run lint` | PASS | Existing ESLint configuration; no rules weakened |
| Client `VITE_API_BASE_URL=http://127.0.0.1:5000/api npm run build` | PASS | Vite 8.3.0, 136 modules; compile/bundle only |
| Server `npm run check:syntax` | PASS | 82 JavaScript files, including migrations, helper and test |
| Server `npm run test:smoke` | PASS | 1 test, 0 failures; actual isolated health router via loopback HTTP |

An initial build without `VITE_API_BASE_URL` failed with misleading missing-export diagnostics. The module deliberately throws when that configuration is absent; supplying the existing required public configuration resolved the build without source changes. CI explicitly supplies it. Build output does not establish browser behavior.

The smoke test asserts status 200, JSON content type and exact current body (including the existing `sucess` spelling), plus 404 for an unknown route. It mounts the real router but deliberately does not import `server.js`. No database success is fabricated and no env secrets or service stubs are used.

## Hosted evidence

The `Verify` workflow records results against each commit in GitHub Actions. The original jobs upload `client-verification` (lint/build logs) and `server-verification` (syntax/smoke logs); failures propagate through `pipefail`. Mobile and integration extensions are described below. Always-run summaries state scope. Local results are not claims that a hosted run has passed: inspect the run attached to the commit for hosted status and logs.

## Mobile extension — 2026-10-21

The workflow now also runs server `test:mobile` and a third `mobile` job for TypeScript, session/message logic tests, and Android/iOS/web JavaScript exports. It uploads `mobile-verification` logs. The mobile auth HTTP tests explicitly inject the auth-service boundary; they do not establish real MySQL-backed login, token rotation or session revocation. See [mobile evidence](mobile.md) for this change's local results and UI checks.

## Real-service integration extension - 2026-10-21

A fourth job runs the actual mobile JavaScript adapters against the real API, a disposable MySQL service and authenticated TLS SMTP capture. It applies all migrations to a fresh schema, uses synthetic accounts, and covers verification, persistence, authorization, receipts, retries, restart recovery and session rotation/revocation. Its `real-service-integration` artifact includes the command log and a machine-readable report. Production credentials are not used. See [current integration evidence](mobile-integration.json) and [runner instructions](../../server/test/integration/README.md).

## Explicitly unverified

The separate `Native preview` workflow adds Android APK compilation/emulator
UI and iOS simulator compilation/UI. It publishes sample-only build artifacts
and evidence. Its run must be inspected separately from the four-job `Verify`
workflow. See [native build instructions](../../mobile/BUILDING.md).

- Native SecureStore, physical Android/iPhone UI and background/network behavior.
- Delivery to external email inboxes through the selected production provider.
- Full browser-to-phone and phone-to-phone UI flows.
- Native binary compilation/signing and production deployment.

The real-service suite establishes the backend and JavaScript adapter paths in isolation; it does not establish these native/provider/production properties. A passing health-router test is not readiness, and syntax checks do not execute imports or validate runtime compatibility. No production credentials are required by this workflow. Dependency audit/security certification is outside these checks.
