"use strict";

// Real MySQL + the real API/outbox + a TLS SMTP capture server. Synthetic
// accounts only. No auth, repository, mail-transport or Socket.IO mocks.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { once } = require("node:events");
const { pathToFileURL } = require("node:url");
const mysql = require("mysql2/promise");
const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const { io } = require("socket.io-client");
const jwt = require("jsonwebtoken");

const execute = promisify(execFile);
const serverRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(serverRoot, "..");
const nonce = crypto.randomBytes(6).toString("hex");
const database = `chatsphere_it_${nonce}`;
const dbUser = `cs_it_${nonce}`;
const password = () => crypto.randomBytes(24).toString("hex");
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope:
    "Real MySQL, actual mobile JS adapters, real API/Socket.IO and TLS SMTP capture",
  checks: [],
  limitations: [
    "No physical native device or SecureStore test",
    "No external email-provider/inbox delivery",
    "No APK/IPA signing or production deployment",
  ],
};
let phase = "prepare";
let runtime, dbProcess, apiProcess, smtp, admin, db, env, baseUrl;
let createdDatabase = false,
  createdUser = false;
let dbAccountHost = "localhost";
const clients = [];
const sockets = [];
const capturedMail = [];
let apiLog = "";
let mysqlLog = "";

function safeError(error) {
  return `${error.code || error.name || "Error"}: ${error.message}`;
}
function child(binary, args, options = {}) {
  const process = spawn(binary, args, {
    cwd: serverRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  process.on("error", (error) => {
    process.startError = error;
  });
  return process;
}
async function stop(process) {
  if (!process || process.exitCode !== null || process.signalCode !== null)
    return;
  const exited = once(process, "exit").catch(() => {});
  process.kill();
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (process.exitCode === null && process.signalCode === null)
    process.kill("SIGKILL");
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function until(description, fn, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${description}`);
}
async function check(name, fn) {
  phase = name;
  const start = Date.now();
  await fn();
  report.checks.push({
    name,
    status: "passed",
    durationMs: Date.now() - start,
  });
  console.log(`PASS ${name}`);
}
async function request(
  route,
  { body, token, cookie, method = body === undefined ? "GET" : "POST" } = {},
) {
  const response = await fetch(baseUrl + route, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  return { status: response.status, headers: response.headers, json };
}
async function ok(route, options, expected = 200) {
  const response = await request(route, options);
  assert.equal(
    response.status,
    expected,
    `${route}: ${response.json.code || response.json.error?.code || response.json.message}`,
  );
  assert.equal(response.json.success, true, `${route} success`);
  return response;
}
async function prepareCertificate(openssl) {
  const file = (name) => path.join(runtime, name);
  const command = (args) =>
    execute(openssl, args, { cwd: runtime, windowsHide: true, timeout: 30000 });
  await command([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    file("ca.key"),
    "-out",
    file("ca.crt"),
    "-subj",
    "/CN=ChatSphere integration CA",
    "-days",
    "1",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  ]);
  await command([
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    file("smtp.key"),
    "-out",
    file("smtp.csr"),
    "-subj",
    "/CN=localhost",
  ]);
  await fs.writeFile(
    file("smtp.ext"),
    "subjectAltName=IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n",
  );
  await command([
    "x509",
    "-req",
    "-in",
    file("smtp.csr"),
    "-CA",
    file("ca.crt"),
    "-CAkey",
    file("ca.key"),
    "-CAcreateserial",
    "-out",
    file("smtp.crt"),
    "-days",
    "1",
    "-sha256",
    "-extfile",
    file("smtp.ext"),
  ]);
}
async function startApi() {
  apiProcess = child(process.execPath, ["src/server.js"], { env });
  const capture = (data) => {
    apiLog = (apiLog + data.toString()).slice(-100000);
  };
  apiProcess.stdout.on("data", capture);
  apiProcess.stderr.on("data", capture);
  await until("real API startup", async () => {
    if (apiProcess.startError) throw apiProcess.startError;
    if (apiProcess.exitCode !== null)
      throw new Error(
        "API exited before startup; inspect the test runtime log.",
      );
    try {
      return (
        (
          await fetch(baseUrl + "/health", {
            signal: AbortSignal.timeout(1000),
          })
        ).status === 200
      );
    } catch {
      return false;
    }
  });
}
function socketEvent(socket, event, predicate = () => true, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const handler = (result) => {
      if (predicate(result)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(result);
      }
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    socket.on(event, handler);
  });
}
function acknowledge(socket, event, payload) {
  return new Promise((resolve, reject) =>
    socket
      .timeout(12000)
      .emit(event, payload, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
  );
}
function connectRaw(token) {
  const socket = io(new URL(baseUrl).origin, {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token },
    reconnection: false,
  });
  sockets.push(socket);
  return socket;
}
async function connected(client) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Mobile realtime adapter did not connect"));
    }, 15000);
    const unsubscribe = client.subscribe((event) => {
      if (event.type === "connection" && event.value === "connected") {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
    client.setActive(true);
  });
}
function incoming(client, content) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Mobile adapter missed a realtime message"));
    }, 12000);
    const unsubscribe = client.subscribe((event) => {
      if (event.type === "message" && event.message.content === content) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(event.message);
      }
    });
  });
}

async function setup() {
  runtime = await fs.mkdtemp(path.join(os.tmpdir(), "chatsphere-it-"));
  const isWindows = process.platform === "win32";
  const mysqlBinary =
    process.env.CHATSPHERE_IT_MYSQLD ||
    (isWindows
      ? "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe"
      : "mysqld");
  const openssl =
    process.env.CHATSPHERE_IT_OPENSSL ||
    (isWindows ? "C:\\Program Files\\Git\\usr\\bin\\openssl.exe" : "openssl");
  await prepareCertificate(openssl);
  const external = process.env.CHATSPHERE_IT_EXTERNAL_MYSQL === "1";
  let dbPort;
  let rootPassword;
  if (external) {
    // Explicit CI/test server only. We generate a fresh schema and never accept
    // an existing application's database name, account or remote host.
    assert.equal(
      process.env.CHATSPHERE_IT_DB_HOST,
      "127.0.0.1",
      "External test DB must be loopback",
    );
    dbPort = Number(process.env.CHATSPHERE_IT_DB_PORT || 3306);
    rootPassword = process.env.CHATSPHERE_IT_ROOT_PASSWORD;
    assert.ok(rootPassword, "Dedicated test MySQL root credential is required");
    // Docker port forwarding changes the source address seen inside the
    // dedicated CI container. This account is limited to our fresh test schema.
    dbAccountHost = "%";
  } else {
    dbPort = await freePort();
    const datadir = path.join(runtime, "mysql-data");
    await fs.mkdir(datadir);
    const common = [
      "--no-defaults",
      ...(isWindows
        ? [`--basedir=${path.dirname(path.dirname(mysqlBinary))}`]
        : []),
      `--datadir=${datadir}`,
    ];
    const version = await execute(mysqlBinary, ["--version"], {
      windowsHide: true,
    });
    report.mysqlBinary = version.stdout.trim();
    await execute(
      mysqlBinary,
      [...common, "--initialize-insecure", "--console"],
      { windowsHide: true, timeout: 60000 },
    );
    dbProcess = child(mysqlBinary, [
      ...common,
      `--port=${dbPort}`,
      "--bind-address=127.0.0.1",
      "--mysqlx=0",
      "--skip-log-bin",
      "--innodb-buffer-pool-size=64M",
      `--pid-file=${path.join(runtime, "mysql.pid")}`,
      "--console",
    ]);
    const capture = (data) => {
      mysqlLog = (mysqlLog + data.toString()).slice(-50000);
    };
    dbProcess.stdout.on("data", capture);
    dbProcess.stderr.on("data", capture);
    await until("isolated MySQL startup", async () => {
      if (dbProcess.startError) throw dbProcess.startError;
      if (dbProcess.exitCode !== null)
        throw new Error("Isolated MySQL exited before startup");
      try {
        admin = await mysql.createConnection({
          host: "127.0.0.1",
          port: dbPort,
          user: "root",
          password: "",
          connectTimeout: 1000,
        });
        return true;
      } catch {
        return false;
      }
    });
    rootPassword = password();
    await admin.query(
      `ALTER USER 'root'@'localhost' IDENTIFIED BY ${admin.escape(rootPassword)}`,
    );
  }
  if (!admin)
    admin = await mysql.createConnection({
      host: "127.0.0.1",
      port: dbPort,
      user: "root",
      password: rootPassword,
    });
  const [[version]] = await admin.query("SELECT VERSION() AS version");
  report.mysql = version.version;
  assert.match(version.version, /^8\./, "Use MySQL 8 for this test");
  await admin.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  createdDatabase = true;
  const appPassword = password();
  await admin.query(
    `CREATE USER '${dbUser}'@'${dbAccountHost}' IDENTIFIED BY ${admin.escape(appPassword)}`,
  );
  createdUser = true;
  await admin.query(
    `GRANT ALL ON \`${database}\`.* TO '${dbUser}'@'${dbAccountHost}'`,
  );
  db = await mysql.createConnection({
    host: "127.0.0.1",
    port: dbPort,
    user: dbUser,
    password: appPassword,
    database,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  const smtpPort = await freePort();
  const smtpPassword = password();
  smtp = new SMTPServer({
    secure: true,
    name: "localhost",
    key: await fs.readFile(path.join(runtime, "smtp.key")),
    cert: await fs.readFile(path.join(runtime, "smtp.crt")),
    logger: false,
    disableReverseLookup: true,
    authOptional: false,
    closeTimeout: 1000,
    onAuth(auth, session, callback) {
      callback(
        session.secure &&
          auth.username === "integration" &&
          auth.password === smtpPassword
          ? null
          : new Error("Test SMTP authentication rejected"),
        { user: "integration" },
      );
    },
    onData(stream, session, callback) {
      simpleParser(stream)
        .then((mail) => {
          capturedMail.push({
            to: session.envelope.rcptTo.map((r) => r.address),
            secure: session.secure,
            text: mail.text,
          });
          callback();
        })
        .catch(callback);
    },
  });
  smtp.on("error", () => {});
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(smtpPort, "127.0.0.1", resolve);
  });
  const apiPort = await freePort();
  baseUrl = `http://127.0.0.1:${apiPort}/api`;
  env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(apiPort),
    BIND_HOST: "127.0.0.1",
    CLIENT_ORIGIN: "http://127.0.0.1:18081",
    DB_HOST: "127.0.0.1",
    DB_PORT: String(dbPort),
    DB_NAME: database,
    DB_USER: dbUser,
    DB_PASSWORD: appPassword,
    JWT_ACCESS_SECRET: password().slice(0, 32) + password().slice(0, 32),
    REFRESH_TOKEN_HMAC_SECRET:
      password().slice(0, 32) + password().slice(0, 32),
    JWT_ACCESS_TOKEN_TTL_SECONDS: "300",
    REFRESH_TOKEN_TTL_DAYS: "1",
    JWT_ISSUER: "chatsphere-integration",
    JWT_AUDIENCE: "chatsphere-integration",
    VERIFICATION_HMAC_SECRET: password() + password(),
    OUTBOX_ENCRYPTION_KEY_VERSION: "1",
    OUTBOX_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtpPort),
    SMTP_SECURE: "true",
    SMTP_USER: "integration",
    SMTP_PASSWORD: smtpPassword,
    MAIL_FROM: "ChatSphere integration <test@example.test>",
    LOG_LEVEL: "warn",
    NODE_EXTRA_CA_CERTS: path.join(runtime, "ca.crt"),
  };
  await check("MySQL migrations apply to a fresh database", async () => {
    await execute(
      process.execPath,
      [
        "node_modules/sequelize-cli/lib/sequelize",
        "db:migrate",
        "--env",
        "development",
      ],
      { cwd: serverRoot, env, windowsHide: true, timeout: 60000 },
    );
    const [migrations] = await db.query(
      "SELECT name FROM SequelizeMeta ORDER BY name",
    );
    assert.equal(migrations.length, 10);
    report.migrations = migrations.map((m) => m.name);
  });
  await check("The real API starts after MySQL authentication", startApi);
}

async function testApplication() {
  const load = (relative) =>
    import(pathToFileURL(path.join(repoRoot, "mobile", relative)).href);
  const { Session } = await load("src/core/session.ts");
  const { createTransport } = await load("src/core/http.ts");
  const { LiveClient } = await load("src/liveClient.ts");
  const accounts = ["alice", "bob", "outsider"].map((name) => ({
    username: `${name}_${nonce}`,
    email: `${name}_${nonce}@example.test`,
    password: password(),
  }));
  await check(
    "Registration, encrypted outbox and verification over authenticated TLS SMTP",
    async () => {
      for (const account of accounts) {
        await ok("/auth/register", { body: account }, 201);
        const denied = await request("/auth/mobile/login", {
          body: { email: account.email, password: account.password },
        });
        assert.equal(denied.status, 403);
        assert.equal(denied.json.code, "ACCOUNT_NOT_VERIFIED");
        const mail = await until("SMTP verification delivery", () =>
          capturedMail.find((mail) => mail.to.includes(account.email)),
        );
        assert.equal(mail.secure, true);
        const code = /verification code is (\d+)/i.exec(mail.text)?.[1];
        assert.ok(code, "Verification code arrived in SMTP email");
        await ok("/auth/verify", { body: { email: account.email, code } });
      }
      await until("outbox SENT state", async () => {
        const [[row]] = await db.query(
          "SELECT COUNT(*) AS count FROM notification_outbox WHERE status='SENT'",
        );
        return Number(row.count) === 3;
      });
      const [rows] = await db.query(
        "SELECT password_hash, email_verified_at FROM users",
      );
      assert.equal(rows.length, 3);
      rows.forEach((row) => {
        assert.match(row.password_hash, /^\$(argon2|2[aby])/);
        assert.ok(row.email_verified_at);
      });
      const [outbox] = await db.query(
        "SELECT payload_ciphertext, payload_iv, payload_auth_tag, key_version FROM notification_outbox",
      );
      outbox.forEach((row) => {
        assert.ok(row.payload_ciphertext);
        assert.equal(
          row.payload_ciphertext.includes("verificationCode"),
          false,
        );
        assert.equal(Buffer.from(row.payload_iv, "base64").length, 12);
        assert.equal(Buffer.from(row.payload_auth_tag, "base64").length, 16);
        assert.equal(row.key_version, 1);
      });
    },
  );
  const loggedIn = [];
  await check(
    "Actual mobile session adapters sign in and persist rotating refresh tokens",
    async () => {
      for (const account of accounts) {
        const store = {
          value: null,
          async get() {
            return this.value;
          },
          async set(value) {
            this.value = value;
          },
          async remove() {
            this.value = null;
          },
        };
        const session = new Session(createTransport(baseUrl), store);
        await session.login(account.email, account.password);
        assert.equal(session.getSnapshot().status, "ready");
        assert.ok(store.value);
        assert.ok(session.getToken());
        const client = new LiveClient(session, baseUrl);
        clients.push(client);
        loggedIn.push({
          account,
          session,
          store,
          client,
          user: session.getSnapshot().user,
        });
      }
      await Promise.all(loggedIn.map(({ client }) => connected(client)));
    },
  );
  const [alice, bob, outsider] = loggedIn;
  let direct, first, second;
  await check(
    "User search and direct-conversation creation use the real API",
    async () => {
      const users = await alice.client.search(bob.user.username);
      assert.ok(users.some((user) => user.id === bob.user.id));
      direct = await alice.client.direct(bob.user);
      assert.equal(direct.type, "DIRECT");
      const duplicate = await alice.client.direct(bob.user);
      assert.equal(duplicate.id, direct.id);
    },
  );
  await check(
    "Mobile Socket.IO send, receive and history persist to MySQL",
    async () => {
      const content = "Real mobile integration message";
      const delivered = incoming(bob.client, content);
      first = await alice.client.send(direct.id, content, crypto.randomUUID());
      assert.equal((await delivered).id, first.id);
      const history = await bob.client.history(direct.id);
      assert.ok(history.messages.some((message) => message.id === first.id));
      const [[row]] = await db.query(
        "SELECT COUNT(*) AS count FROM messages WHERE id=? AND content=?",
        [first.id, content],
      );
      assert.equal(Number(row.count), 1);
    },
  );
  await check(
    "Delivery and read acknowledgements persist in database receipts",
    async () => {
      await until("delivery receipt", async () => {
        const [[row]] = await db.query(
          "SELECT delivered_at FROM message_receipts WHERE message_id=? AND user_id=?",
          [first.id, bob.user.id],
        );
        return !!row?.delivered_at;
      });
      await bob.client.read(direct.id, first.id);
      const [[member]] = await db.query(
        "SELECT last_read_message_id FROM conversation_members WHERE conversation_id=? AND user_id=?",
        [direct.id, bob.user.id],
      );
      assert.equal(String(member.last_read_message_id), first.id);
    },
  );
  await check(
    "Lost-acknowledgement retry is idempotent and rejects conflicting content",
    async () => {
      const socket = connectRaw(alice.session.getToken());
      const ready = socketEvent(socket, "connect");
      socket.connect();
      await ready;
      const id = crypto.randomUUID();
      const payload = {
        conversationId: direct.id,
        content: "Acknowledgement intentionally ignored",
        clientMessageId: id,
      };
      socket.emit("message:send", payload); // Intentionally omit the callback.
      await until("message persisted without acknowledgement", async () => {
        const [[row]] = await db.query(
          "SELECT id FROM messages WHERE sender_id=? AND client_message_id=?",
          [alice.user.id, id],
        );
        return !!row;
      });
      second = await alice.client.send(direct.id, payload.content, id);
      const [[row]] = await db.query(
        "SELECT COUNT(*) AS count FROM messages WHERE sender_id=? AND client_message_id=?",
        [alice.user.id, id],
      );
      assert.equal(Number(row.count), 1);
      await assert.rejects(
        alice.client.send(direct.id, "Conflicting retry", id),
      );
      const page = await ok(`/conversations/${direct.id}/messages?limit=1`, {
        token: bob.session.getToken(),
      });
      assert.equal(page.json.data.pagination.hasMore, true);
      const older = await bob.client.history(
        direct.id,
        page.json.data.pagination.nextCursor,
      );
      assert.ok(older.messages.some((message) => message.id === first.id));
    },
  );
  await check(
    "Conversation authorization blocks outsiders over HTTP and Socket.IO",
    async () => {
      const history = await request(`/conversations/${direct.id}/messages`, {
        token: outsider.session.getToken(),
      });
      assert.equal(history.status, 404);
      assert.equal(history.json.code, "CONVERSATION_NOT_FOUND");
      assert.equal(history.json.data, undefined);
      await assert.rejects(
        outsider.client.send(
          direct.id,
          "Unauthorized attempt",
          crypto.randomUUID(),
        ),
      );
      const socket = connectRaw("invalid-token");
      const rejected = socketEvent(socket, "connect_error");
      socket.connect();
      await rejected;
      assert.equal(socket.connected, false);
    },
  );
  await check(
    "Group messages deliver to members; removal revokes history access",
    async () => {
      const group = await alice.session.request("/conversations/group", {
        method: "POST",
        body: { title: "Integration group", memberIds: [bob.user.id] },
      });
      const arrived = incoming(bob.client, "Group integration message");
      const message = await alice.client.send(
        group.id,
        "Group integration message",
        crypto.randomUUID(),
      );
      assert.equal((await arrived).id, message.id);
      await alice.session.request(
        `/conversations/${group.id}/members/${bob.user.id}`,
        { method: "DELETE" },
      );
      const denied = await request(`/conversations/${group.id}/messages`, {
        token: bob.session.getToken(),
      });
      assert.equal(denied.status, 404);
      assert.equal(denied.json.code, "CONVERSATION_NOT_FOUND");
    },
  );
  await check(
    "Database foreign-key constraints reject orphan messages",
    async () => {
      await assert.rejects(
        db.execute(
          "INSERT INTO messages (conversation_id,sender_id,client_message_id,type,content,created_at,updated_at) VALUES (?,?,?,?,?,NOW(),NOW())",
          [
            "18446744073709551614",
            alice.user.id,
            crypto.randomUUID(),
            "TEXT",
            "Invalid reference",
          ],
        ),
        (error) => error.code === "ER_NO_REFERENCED_ROW_2",
      );
    },
  );
  await check(
    "API restart preserves sessions/history and mobile clients reconnect",
    async () => {
      loggedIn.forEach(({ client }) => client.setActive(false));
      await stop(apiProcess);
      await startApi();
      const history = await alice.client.history(direct.id);
      assert.ok(history.messages.some((message) => message.id === first.id));
      assert.ok(history.messages.some((message) => message.id === second.id));
      await Promise.all(loggedIn.map(({ client }) => connected(client)));
      const arrived = incoming(bob.client, "Message after API restart");
      const message = await alice.client.send(
        direct.id,
        "Message after API restart",
        crypto.randomUUID(),
      );
      assert.equal((await arrived).id, message.id);
    },
  );
  await check(
    "Browser cookie login/refresh remains separate from native token transport",
    async () => {
      const browser = await ok("/auth/login", {
        body: { email: alice.account.email, password: alice.account.password },
      });
      assert.ok(browser.headers.get("set-cookie")?.includes("HttpOnly"));
      assert.equal(browser.json.data.refreshToken, undefined);
      const refreshed = await ok("/auth/refresh", {
        body: {},
        cookie: browser.headers.get("set-cookie").split(";")[0],
      });
      assert.ok(refreshed.headers.get("set-cookie"));
      assert.equal(refreshed.json.data.refreshToken, undefined);
      const native = await ok("/auth/mobile/login", {
        body: { email: alice.account.email, password: alice.account.password },
      });
      assert.equal(native.headers.get("set-cookie"), null);
      assert.equal(native.headers.get("cache-control"), "no-store");
      assert.ok(native.json.data.refreshToken);
    },
  );
  await check(
    "JWT expiry disconnects the socket and the actual mobile adapter refreshes/reconnects",
    async () => {
      const payload = jwt.decode(alice.session.getToken());
      // Sign one short-lived JWT with this run's ephemeral key. The production
      // login TTL policy stays unchanged. Refresh still uses the actual service.
      const shortToken = jwt.sign(
        { sub: payload.sub, sid: payload.sid, type: "access" },
        Buffer.from(env.JWT_ACCESS_SECRET, "hex"),
        {
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
          jwtid: crypto.randomUUID(),
          expiresIn: 5,
        },
      );
      let firstHandshake = true;
      let refreshes = 0;
      const timedSession = {
        getSnapshot: alice.session.getSnapshot,
        getToken: () =>
          firstHandshake ? shortToken : alice.session.getToken(),
        freshToken: () => alice.session.freshToken(),
        async refresh() {
          await alice.session.refresh();
          firstHandshake = false;
          refreshes++;
        },
      };
      const timedClient = new LiveClient(timedSession, baseUrl);
      clients.push(timedClient);
      await connected(timedClient);
      assert.equal(refreshes, 0, "Short-lived JWT must authenticate before expiry");
      await connected(timedClient); // Waits for the next real Socket.IO connect.
      assert.equal(refreshes, 1);
      const rejected = await request("/conversations", { token: shortToken });
      assert.equal(rejected.status, 401);
      assert.equal(rejected.json.code, "INVALID_ACCESS_TOKEN");
      const received = incoming(
        timedClient,
        "Message after access-token expiry",
      );
      const message = await bob.client.send(
        direct.id,
        "Message after access-token expiry",
        crypto.randomUUID(),
      );
      assert.equal((await received).id, message.id);
      timedClient.close();
    },
  );
  await check(
    "Concurrent mobile refresh, stale-token grace and replay revocation work against MySQL",
    async () => {
      const original = alice.store.value;
      await Promise.all([
        alice.session.refresh(),
        alice.session.refresh(),
        alice.session.refresh(),
      ]);
      assert.notEqual(alice.store.value, original);
      const stale = await request("/auth/mobile/refresh", {
        body: { refreshToken: original },
      });
      assert.equal(stale.status, 401);
      assert.equal(stale.json.code, "REFRESH_ALREADY_ROTATED");
      await alice.session.request("/conversations");
      await alice.session.refresh(); // Original token is now two generations old.
      const replay = await request("/auth/mobile/refresh", {
        body: { refreshToken: original },
      });
      assert.equal(replay.status, 401);
      assert.equal(replay.json.code, "REFRESH_TOKEN_REUSE_DETECTED");
      const blocked = await request("/conversations", {
        token: alice.session.getToken(),
      });
      assert.equal(blocked.status, 401);
      await assert.rejects(alice.session.refresh());
      assert.equal(alice.store.value, null);
      assert.equal(alice.session.getSnapshot().status, "signed-out");
    },
  );
  await check(
    "Logout revokes HTTP and already-connected socket sessions",
    async () => {
      const token = bob.session.getToken();
      const socket = connectRaw(token);
      const ready = socketEvent(socket, "connect");
      socket.connect();
      await ready;
      assert.equal(await bob.session.logout(), true);
      assert.equal(bob.store.value, null);
      const denied = await request("/conversations", { token });
      assert.equal(denied.status, 401);
      const attempt = await acknowledge(socket, "message:send", {
        conversationId: direct.id,
        content: "After logout",
        clientMessageId: crypto.randomUUID(),
      });
      assert.equal(attempt.success, false);
      assert.equal(attempt.error.code, "SESSION_REVOKED");
    },
  );
}

async function cleanup() {
  clients.forEach((client) => client.close());
  sockets.forEach((socket) => socket.disconnect());
  await stop(apiProcess);
  if (smtp) await new Promise((resolve) => smtp.close(resolve));
  if (db) await db.end().catch(() => {});
  if (admin) {
    // Names are generated internally. Never accept a user-provided schema here.
    assert.match(database, /^chatsphere_it_[a-f0-9]{12}$/);
    assert.match(dbUser, /^cs_it_[a-f0-9]{12}$/);
    if (createdDatabase)
      await admin.query(`DROP DATABASE \`${database}\``).catch(() => {});
    if (createdUser)
      await admin
        .query(`DROP USER '${dbUser}'@'${dbAccountHost}'`)
        .catch(() => {});
    if (dbProcess) await admin.query("SHUTDOWN").catch(() => {});
    await admin.end().catch(() => {});
  }
  await stop(dbProcess);
  if (runtime) {
    // Windows recursive-delete boundary: verify the absolute target is precisely
    // the owned test directory below the current OS temporary directory.
    const resolved = path.resolve(runtime);
    const parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), parent);
    assert.match(path.basename(resolved), /^chatsphere-it-[A-Za-z0-9]+$/);
    await fs
      .rm(resolved, {
        recursive: true,
        force: true,
        maxRetries: 4,
        retryDelay: 200,
      })
      .catch(() => {});
  }
}

(async () => {
  try {
    await setup();
    await testApplication();
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = { phase, error: safeError(error) };
    console.error(`FAIL ${phase}: ${safeError(error)}`);
    // Logs may include synthetic test identifiers; keep them local and never
    // include raw credentials, tokens or verification codes in the report.
    if (process.env.CHATSPHERE_IT_DEBUG === "1")
      console.error(apiLog || mysqlLog);
    process.exitCode = 1;
  } finally {
    await cleanup();
    report.completedAt = new Date().toISOString();
    if (process.env.CHATSPHERE_IT_REPORT)
      await fs.writeFile(
        path.resolve(process.env.CHATSPHERE_IT_REPORT),
        JSON.stringify(report, null, 2) + "\n",
      );
  }
})();
