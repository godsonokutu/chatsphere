"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const jwtConfig = require("../config/jwt.config");

const REFRESH_TOKEN_VERSION = "rt1";
const REFRESH_SECRET_BYTES = 48;
const SESSION_ID_BYTES = 32;
const FAMILY_ID_BYTES = 32;

const MAX_REFRESH_TOKEN_LENGTH = 512;

function generateSessionId() {
  return crypto
    .randomBytes(SESSION_ID_BYTES)
    .toString("hex");
}

function generateFamilyId() {
  return crypto
    .randomBytes(FAMILY_ID_BYTES)
    .toString("hex");
}

function createAccessToken({
  userId,
  sessionId,
}) {
  if (!userId) {
    throw new TypeError("userId is required");
  }

  if (!sessionId) {
    throw new TypeError("sessionId is required");
  }

  return jwt.sign(
    {
      sid: sessionId,
      type: "access",
    },
    jwtConfig.accessTokenSecret,
    {
      algorithm: jwtConfig.algorithm,

      expiresIn:
        jwtConfig.accessTokenTtlSeconds,

      issuer: jwtConfig.issuer,

      audience: jwtConfig.audience,

      subject: String(userId),

      jwtid: crypto.randomUUID(),
    }
  );
}

function verifyAccessToken(token) {
  if (
    typeof token !== "string" ||
    token.length === 0
  ) {
    throw new Error("Invalid access token");
  }

  const payload = jwt.verify(
    token,
    jwtConfig.accessTokenSecret,
    {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    }
  );

  if (
    payload.type !== "access" ||
    !payload.sub ||
    !payload.sid
  ) {
    throw new Error(
      "Invalid access token payload"
    );
  }

  return payload;
}

function signRefreshTokenPayload(payload) {
  return crypto
    .createHmac(
      "sha256",
      jwtConfig.refreshTokenHmacSecret
    )
    .update(payload)
    .digest("hex");
}

function createRefreshToken({
  sessionId,
  generation,
}) {
  if (
    typeof sessionId !== "string" ||
    !/^[a-f0-9]{64}$/i.test(sessionId)
  ) {
    throw new TypeError(
      "Invalid sessionId"
    );
  }

  if (
    !Number.isSafeInteger(generation) ||
    generation < 0
  ) {
    throw new TypeError(
      "Invalid refresh generation"
    );
  }

  const secret = crypto
    .randomBytes(REFRESH_SECRET_BYTES)
    .toString("base64url");

  const unsignedToken = [
    REFRESH_TOKEN_VERSION,
    sessionId,
    String(generation),
    secret,
  ].join(".");

  const signature =
    signRefreshTokenPayload(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

function timingSafeHexEqual(
  expectedHex,
  suppliedHex
) {
  if (
    typeof expectedHex !== "string" ||
    typeof suppliedHex !== "string"
  ) {
    return false;
  }

  if (
    !/^[a-f0-9]{64}$/i.test(expectedHex) ||
    !/^[a-f0-9]{64}$/i.test(suppliedHex)
  ) {
    return false;
  }

  const expected =
    Buffer.from(expectedHex, "hex");

  const supplied =
    Buffer.from(suppliedHex, "hex");

  if (expected.length !== supplied.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expected,
    supplied
  );
}

function parseAndVerifyRefreshToken(token) {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_REFRESH_TOKEN_LENGTH
  ) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  const parts = token.split(".");

  if (parts.length !== 5) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  const [
    version,
    sessionId,
    generationText,
    secret,
    suppliedSignature,
  ] = parts;

  if (version !== REFRESH_TOKEN_VERSION) {
    throw new Error(
      "Unsupported refresh token version"
    );
  }

  if (
    !/^[a-f0-9]{64}$/i.test(sessionId)
  ) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  if (!/^\d+$/.test(generationText)) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  const generation =
    Number(generationText);

  if (
    !Number.isSafeInteger(generation) ||
    generation < 0 ||
    String(generation) !== generationText
  ) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  if (
    !/^[A-Za-z0-9_-]+$/.test(secret) ||
    secret.length < 32
  ) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  const unsignedToken = [
    version,
    sessionId,
    generationText,
    secret,
  ].join(".");

  const expectedSignature =
    signRefreshTokenPayload(unsignedToken);

  if (
    !timingSafeHexEqual(
      expectedSignature,
      suppliedSignature
    )
  ) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  return {
    sessionId,
    generation,
  };
}

function hashRefreshToken(token) {
  if (
    typeof token !== "string" ||
    token.length === 0
  ) {
    throw new TypeError(
      "Refresh token is required"
    );
  }

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function verifyRefreshTokenHash(
  token,
  storedHash
) {
  const calculatedHash =
    hashRefreshToken(token);

  return timingSafeHexEqual(
    calculatedHash,
    storedHash
  );
}

function calculateSessionExpiry(
  now = new Date()
) {
  return new Date(
    now.getTime() +
      jwtConfig.refreshTokenTtlSeconds *
        1000
  );
}

module.exports = {
  generateSessionId,
  generateFamilyId,

  createAccessToken,
  verifyAccessToken,

  createRefreshToken,
  parseAndVerifyRefreshToken,

  hashRefreshToken,
  verifyRefreshTokenHash,

  calculateSessionExpiry,
};