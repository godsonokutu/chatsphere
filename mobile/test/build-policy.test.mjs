import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBuild } from "../scripts/build-policy.cjs";

test("production cannot ship without a deployed HTTPS API", () => {
  for (const value of [
    undefined,
    "http://api.chatsphere.dev/api",
    "https://example.com/api",
    "https://127.0.0.1/api",
    "https://localhost/api",
    "https://demo.test/api",
    "https://user:secret@api.chatsphere.dev/api",
    "https://api.chatsphere.dev/",
    "https://api.chatsphere.dev/api?token=x",
  ]) {
    assert.throws(() =>
      resolveBuild({
        EXPO_PUBLIC_APP_VARIANT: "production",
        EXPO_PUBLIC_API_URL: value,
      }),
    );
  }
});
test("staging has the same API gate and a separate installed identity", () => {
  assert.throws(() => resolveBuild({ EXPO_PUBLIC_APP_VARIANT: "staging" }));
  const live = resolveBuild({
    EXPO_PUBLIC_APP_VARIANT: "production",
    EXPO_PUBLIC_API_URL: "https://api.chatsphere.dev/api",
  });
  const stage = resolveBuild({
    EXPO_PUBLIC_APP_VARIANT: "staging",
    EXPO_PUBLIC_API_URL: "https://api.chatsphere.dev/api",
  });
  assert.equal(live.identifier, "dev.godsonokutu.chatsphere");
  assert.notEqual(stage.identifier, live.identifier);
  assert.equal(stage.liveOnly, true);
});
test("preview is isolated from production and does not require live credentials", () => {
  const preview = resolveBuild({ EXPO_PUBLIC_APP_VARIANT: "preview" });
  assert.equal(preview.identifier, "dev.godsonokutu.chatsphere.preview");
  assert.equal(preview.liveOnly, false);
  assert.equal(preview.name, "ChatSphere Preview");
});
test("unknown variants fail instead of falling back to preview", () => {
  assert.throws(() => resolveBuild({ EXPO_PUBLIC_APP_VARIANT: "prodution" }));
});
