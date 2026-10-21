const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { z } = require("zod");
const {
  createMobileAuthController,
} = require("../src/controllers/mobileAuth.controller");

// Real HTTP/controller transport contract, injected auth-service boundary.
// This does not execute database-backed login, rotation or reuse detection.
async function fixture(t, service) {
  const app = express();
  app.use(express.json());
  const controller = createMobileAuthController(service);
  app.post("/api/auth/mobile/login", controller.login);
  app.post("/api/auth/mobile/refresh", controller.refresh);
  app.use((error, req, res, next) =>
    res
      .status(error.statusCode || 500)
      .json({ success: false, code: error.code || "ERROR" }),
  );
  const server = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return (path, body, headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/auth/mobile/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
}
const session = {
  user: { id: "1", username: "Godson" },
  accessToken: "test-access",
  accessTokenExpiresIn: 900,
  refreshToken: "test-refresh",
  internalSecret: "never return this",
};

test("mobile login returns only public session fields, no cookie, and no-store", async (t) => {
  let input;
  const post = await fixture(t, {
    login: async (body, context) => {
      input = { body, context };
      return session;
    },
  });
  const response = await post(
    "login",
    { email: "you@example.com", password: "test-password" },
    { "user-agent": "ChatSphere-test" },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  const result = await response.json();
  assert.deepEqual(Object.keys(result.data).sort(), [
    "accessToken",
    "accessTokenExpiresIn",
    "refreshToken",
    "user",
  ]);
  assert.equal(input.context.userAgent, "ChatSphere-test");
  assert.equal(input.context.ipAddress, "127.0.0.1");
});
test("mobile refresh uses the explicit body and never a browser refresh cookie", async (t) => {
  const received = [];
  const post = await fixture(t, {
    refreshSession: async (token) => {
      received.push(token);
      return { ...session, refreshToken: "rotated-test-refresh" };
    },
  });
  const response = await post(
    "refresh",
    { refreshToken: "body-token" },
    { Cookie: "chatsphere_refresh=cookie-token" },
  );
  assert.equal(
    (await response.json()).data.refreshToken,
    "rotated-test-refresh",
  );
  assert.equal(response.headers.get("set-cookie"), null);
  await post("refresh", {}, { Cookie: "chatsphere_refresh=cookie-token" });
  assert.deepEqual(received, ["body-token", undefined]);
});
test("service rejection is propagated with no token response and no-store", async (t) => {
  const post = await fixture(t, {
    refreshSession: async () => {
      throw Object.assign(new Error("Revoked"), {
        statusCode: 401,
        code: "SESSION_REVOKED",
      });
    },
  });
  const response = await post("refresh", { refreshToken: "revoked" });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    success: false,
    code: "SESSION_REVOKED",
  });
});
test("invalid native login input produces a safe 400 response", async (t) => {
  const post = await fixture(t, { login: async () => z.string().parse(42) });
  const response = await post("login", {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_INPUT");
});
