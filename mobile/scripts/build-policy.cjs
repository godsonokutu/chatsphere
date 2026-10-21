"use strict";

// Preview installers have their own app identity and never contact a live API.
// Store/staging builds must fail before compilation if deployment is missing.
function resolveBuild(environment) {
  const variant = environment.EXPO_PUBLIC_APP_VARIANT || "development";
  if (!["development", "preview", "staging", "production"].includes(variant))
    throw new Error("Unknown EXPO_PUBLIC_APP_VARIANT");
  const liveOnly = variant === "production" || variant === "staging";
  if (liveOnly) {
    const value = environment.EXPO_PUBLIC_API_URL;
    if (!value) throw new Error("A live build requires EXPO_PUBLIC_API_URL");
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Invalid API URL");
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/$/, "") !== "/api"
    )
      throw new Error(
        "A live build requires a credential-free HTTPS URL ending in /api",
      );
    if (
      host === "localhost" ||
      host === "[::1]" ||
      host === "0.0.0.0" ||
      /^127\./.test(host) ||
      /(^|\.)(example\.(com|net|org)|localhost|test|invalid|local)$/.test(host)
    )
      throw new Error(
        "Use the reachable deployed API, not a placeholder or loopback host",
      );
  }
  const suffix = variant === "production" ? "" : `.${variant}`;
  const label =
    variant === "production"
      ? ""
      : ` ${variant[0].toUpperCase()}${variant.slice(1)}`;
  return {
    variant,
    liveOnly,
    name: `ChatSphere${label}`,
    identifier: `dev.godsonokutu.chatsphere${suffix}`,
    scheme: `chatsphere${suffix.replace(".", "-")}`,
  };
}
module.exports = { resolveBuild };
