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

The `Verify` workflow records results against each commit in GitHub Actions. Its two jobs upload `client-verification` (lint/build logs) and `server-verification` (syntax/smoke logs); failures propagate through `pipefail`. Always-run summaries state scope. These local results are not claims that a hosted run has passed: inspect the run attached to the CI commit for hosted status and logs.

## Explicitly unverified

- Real MySQL authentication/startup, migrations, constraints and durable writes.
- SMTP-backed account verification and notification-outbox delivery.
- Authenticated API/Socket.IO flows, authorization and session revocation.
- Full browser-to-API/Socket.IO-to-MySQL messaging, receipts and reconnect behavior.

These require configured MySQL and SMTP services plus separate integration/end-to-end coverage. A passing health-router test is not readiness, and syntax checks do not execute imports or validate runtime compatibility. No external secrets are required or referenced by this workflow. Dependency audit/security certification is outside these checks.
