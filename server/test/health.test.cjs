"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const http = require("node:http");
const { test } = require("node:test");
const express = require("express");
const healthRoutes = require("../src/routes/health.routes");

// Exercise the real router, not server.js: no DB authentication, SMTP,
// Socket.IO, or outbox worker is started. This is not a readiness/E2E test.
test("isolated API health route preserves its response contract", { timeout: 5000 }, async (t) => {
  const app = express();
  app.use("/api", healthRoutes);
  const server = http.createServer(app);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await response.json(), {
    // Existing API spelling; changing the public contract is outside this CI task.
    sucess: true,
    message: "ChatSphere API is running",
  });

  const missing = await fetch(`${base}/api/not-a-route`);
  assert.equal(missing.status, 404);
});
