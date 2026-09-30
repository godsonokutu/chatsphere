"use strict";

const env = require("./env");
const jwtConfig = require("./jwt.config");

const isProduction =
  env.NODE_ENV === "production";

const refreshCookieBaseOptions =
  Object.freeze({
    httpOnly: true,

    secure: isProduction,

    sameSite: "lax",

    path: "/api/auth",
  });

module.exports = Object.freeze({
  refreshCookieName:
    "chatsphere_refresh",

  refreshCookieOptions:
    Object.freeze({
      ...refreshCookieBaseOptions,

      maxAge:
        jwtConfig.refreshTokenTtlSeconds *
        1000,
    }),

  refreshCookieClearOptions:
    refreshCookieBaseOptions,
});