"use strict";

const env = require("./env");

const jwtConfig = Object.freeze({
  algorithm: "HS256",

  accessTokenSecret: Buffer.from(
    env.JWT_ACCESS_SECRET,
    "hex"
  ),

  refreshTokenHmacSecret: Buffer.from(
    env.REFRESH_TOKEN_HMAC_SECRET,
    "hex"
  ),

  accessTokenTtlSeconds:
    env.JWT_ACCESS_TOKEN_TTL_SECONDS,

  refreshTokenTtlSeconds:
    env.REFRESH_TOKEN_TTL_DAYS *
    24 *
    60 *
    60,

  issuer: env.JWT_ISSUER,

  audience: env.JWT_AUDIENCE,
});

module.exports = jwtConfig;