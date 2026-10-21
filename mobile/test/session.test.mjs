import test from "node:test";
import assert from "node:assert/strict";
import { Session } from "../src/core/session.ts";
import { ApiError, validateApiUrl } from "../src/core/http.ts";

const result = (n = 1) => ({
  user: { id: "1", username: "Godson" },
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  accessTokenExpiresIn: 900,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function memory(initial = null) {
  return {
    secret: initial,
    writes: [],
    async get() {
      return this.secret;
    },
    async set(v) {
      this.secret = v;
      this.writes.push(v);
    },
    async remove() {
      this.secret = null;
    },
  };
}

test("login uses native endpoint and persists only the refresh token", async () => {
  const store = memory();
  let request;
  const session = new Session(async (path, options) => {
    request = { path, options };
    return result();
  }, store);
  await session.login("you@example.com", "a-password");
  assert.equal(request.path, "/auth/mobile/login");
  assert.deepEqual(request.options.body, {
    email: "you@example.com",
    password: "a-password",
  });
  assert.equal(store.secret, "refresh-1");
  assert.equal(session.getToken(), "access-1");
  assert.equal(session.getSnapshot().status, "ready");
});

test("concurrent expired requests share one refresh operation and persist rotation", async () => {
  const store = memory("refresh-1");
  const gate = deferred();
  let refreshes = 0;
  const session = new Session(async (path, options) => {
    if (path === "/auth/mobile/refresh") {
      refreshes++;
      assert.equal(options.body.refreshToken, "refresh-1");
      await gate.promise;
      return result(2);
    }
    assert.equal(options.token, "access-2");
    return { value: path };
  }, store);
  const first = session.request("/one");
  const second = session.request("/two");
  await new Promise((r) => setImmediate(r));
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(refreshes, 1);
  assert.equal(store.secret, "refresh-2");
});

test("a delayed 401 using the old access token does not rotate the new session twice", async () => {
  const store = memory();
  let refreshes = 0;
  const late = deferred();
  const session = new Session(async (path, options) => {
    if (path.includes("/login")) return result();
    if (path.includes("/refresh")) {
      refreshes++;
      return result(2);
    }
    if (options.token === "access-1") {
      if (path === "/late") await late.promise;
      throw new ApiError("Expired", 401);
    }
    return { ok: true };
  }, store);
  await session.login("you@example.com", "a-password");
  const slow = session.request("/late");
  await session.request("/fast");
  late.resolve();
  await slow;
  assert.equal(refreshes, 1);
});

test("network failure during restoration retains the saved secret and allows retry", async () => {
  const store = memory("refresh-1");
  let offline = true;
  const session = new Session(async () => {
    if (offline) throw new ApiError("Offline");
    return result(2);
  }, store);
  await session.restore();
  assert.equal(session.getSnapshot().status, "unavailable");
  assert.equal(store.secret, "refresh-1");
  offline = false;
  await session.restore();
  assert.equal(session.getSnapshot().status, "ready");
  assert.equal(store.secret, "refresh-2");
});

test("revoked refresh sessions remove the device secret", async () => {
  const store = memory("revoked");
  const session = new Session(async () => {
    throw new ApiError("Revoked", 401, "SESSION_REVOKED");
  }, store);
  await session.restore();
  assert.equal(store.secret, null);
  assert.equal(session.getSnapshot().status, "signed-out");
});

test("an in-flight refresh cannot resurrect a session after local sign-out", async () => {
  const store = memory("refresh-1");
  const gate = deferred();
  const session = new Session(async () => {
    await gate.promise;
    return result(2);
  }, store);
  const refresh = session.refresh();
  await new Promise((r) => setImmediate(r));
  await session.clear();
  gate.resolve();
  await assert.rejects(refresh);
  assert.equal(store.secret, null);
  assert.equal(session.getToken(), null);
  assert.equal(session.getSnapshot().status, "signed-out");
});

test("a secure-store failure never exposes a signed-in state", async () => {
  const store = memory();
  store.set = async () => {
    throw new Error("Storage unavailable");
  };
  const session = new Session(async () => result(), store);
  await assert.rejects(
    session.login("you@example.com", "a-password"),
    /Storage unavailable/,
  );
  assert.equal(session.getToken(), null);
  assert.notEqual(session.getSnapshot().status, "ready");
});

test("offline sign-out clears local state and accurately reports failed server revocation", async () => {
  const store = memory();
  const session = new Session(async (path) => {
    if (path.includes("/login")) return result();
    throw new ApiError("Offline");
  }, store);
  await session.login("you@example.com", "a-password");
  assert.equal(await session.logout(), false);
  assert.equal(store.secret, null);
  assert.equal(session.getSnapshot().status, "signed-out");
});

test("API configuration enforces HTTPS in release and rejects embedded credentials", () => {
  assert.equal(
    validateApiUrl("https://api.example.com/api/", false),
    "https://api.example.com/api",
  );
  assert.throws(() => validateApiUrl("http://api.example.com/api", false));
  assert.throws(() =>
    validateApiUrl("https://user:password@api.example.com/api", true),
  );
  assert.throws(() =>
    validateApiUrl("https://api.example.com/api?token=secret", true),
  );
  assert.throws(() => validateApiUrl("https://api.example.com/wrong", true));
  assert.equal(
    validateApiUrl("http://192.168.1.10:5000/api", true),
    "http://192.168.1.10:5000/api",
  );
});
