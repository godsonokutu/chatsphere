# Real-service mobile integration

This suite executes the actual ChatSphere API, Socket.IO gateway, MySQL repositories, password hashing, refresh-session logic and SMTP outbox. It imports the real mobile `Session` and `LiveClient` adapters. It uses synthetic accounts and email addresses ending in `.test`; no email is sent to real people.

## Run locally on Windows

Requirements: Node.js 24, the MySQL 8 server binary, and OpenSSL. The default paths match the standard MySQL 8.0 and Git for Windows installations. No installed database password or administrator access is required: the runner creates a fresh temporary data directory and starts a separate loopback-only MySQL instance.

From the repository root:

```powershell
npm ci --prefix server
npm ci --prefix mobile
cd server
npm run test:integration
```

For nonstandard binary locations, set `CHATSPHERE_IT_MYSQLD` and/or `CHATSPHERE_IT_OPENSSL`. To save a sanitized JSON result, set `CHATSPHERE_IT_REPORT` to a writable filename whose parent directory already exists.

The runner starts the production server entry point with `BIND_HOST=127.0.0.1`. `BIND_HOST` is optional in ordinary server configuration; omitting it preserves Node's default bind behavior. A physical phone needs a separately configured reachable API address.

## Test boundaries

- All ten actual migrations run against a new `chatsphere_it_<random>` schema.
- The app uses a generated database account restricted to that schema. Names are generated internally; an existing schema name cannot be supplied.
- The installed MySQL service, its data directory and existing databases are not used by the default local runner.
- SMTP runs over TLS with authentication. The API child trusts a temporary test CA through `NODE_EXTRA_CA_CERTS`; certificate verification and the production mail transport's TLS requirement stay enabled.
- Verification codes are read from received MIME messages, then submitted to the real verification endpoint. Database verification state is not seeded or bypassed.
- API/Socket.IO delivery, receipts and history are checked against real MySQL rows. A retry with the same client ID must produce exactly one database message.
- Unauthorized access must return the existing deliberate `404 / CONVERSATION_NOT_FOUND` contract, concealing private-conversation existence. It is not accepted as an arbitrary routing failure.
- Refresh tests use real signed refresh tokens and database rotation. The stale-token grace response must preserve the active session; a token two generations behind must revoke it.
- The expiry test signs one short-lived JWT using the run's ephemeral key and a real session. The actual gateway scheduler and mobile refresh/reconnect handler execute; production login TTL limits are not changed.
- Device secret storage is an in-memory test adapter. This does not test SecureStore, iOS Keychain or Android Keystore.

Owned API/socket/SMTP/MySQL processes are stopped after the run. The generated schema/account are removed, and the absolute temporary-directory boundary is checked before recursive cleanup. No production configuration or credentials are written into the repository.

## CI mode

The `integration` job in `verify.yml` supplies a disposable MySQL 8 container and explicitly sets `CHATSPHERE_IT_EXTERNAL_MYSQL=1`, a loopback host/port and that container's synthetic root credential. In this mode the runner still generates and removes its own schema and scoped account; it does not stop the CI service. SMTP and the API remain owned local child services. The service container is discarded by GitHub afterward.

External email-provider deliverability, native UI/device behavior, signed app binaries and production deployment remain outside this suite.
