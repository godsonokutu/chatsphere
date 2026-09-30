"use strict";

require("dotenv").config();

const {
  z,
} = require("zod");

function isExactly32BytesBase64(
  value
) {
  try {
    return (
      Buffer.from(
        value,
        "base64"
      ).length === 32
    );
  } catch {
    return false;
  }
}

const envSchema =
  z.object({
    NODE_ENV:
      z
        .enum([
          "development",
          "test",
          "production",
        ])
        .default(
          "development"
        ),

    PORT:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(65535)
        .default(5000),

    CLIENT_ORIGIN:
      z
        .string()
        .url()
        .default(
          "http://localhost:5173"
        ),

    // ======================================
    // DATABASE
    // ======================================

    DB_HOST:
      z
        .string()
        .min(1),

    DB_PORT:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(65535)
        .default(3306),

    DB_NAME:
      z
        .string()
        .min(1),

    DB_USER:
      z
        .string()
        .min(1),

    DB_PASSWORD:
      z
        .string()
        .min(1),

    // ======================================
    // AUTHENTICATION
    // ======================================

    JWT_ACCESS_SECRET:
      z
        .string()
        .regex(
          /^[a-fA-F0-9]{64}$/,
          "JWT_ACCESS_SECRET must be exactly 64 hexadecimal characters."
        ),

    REFRESH_TOKEN_HMAC_SECRET:
      z
        .string()
        .regex(
          /^[a-fA-F0-9]{64}$/,
          "REFRESH_TOKEN_HMAC_SECRET must be exactly 64 hexadecimal characters."
        ),

    JWT_ACCESS_TOKEN_TTL_SECONDS:
      z.coerce
        .number()
        .int()
        .min(300)
        .max(3600)
        .default(900),

    REFRESH_TOKEN_TTL_DAYS:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(90)
        .default(30),

    JWT_ISSUER:
      z
        .string()
        .min(1)
        .default(
          "chatsphere-api"
        ),

    JWT_AUDIENCE:
      z
        .string()
        .min(1)
        .default(
          "chatsphere-client"
        ),

    // ======================================
    // ACCOUNT VERIFICATION
    // ======================================

    VERIFICATION_HMAC_SECRET:
      z
        .string()
        .min(
          64,
          "VERIFICATION_HMAC_SECRET must contain at least 64 characters."
        ),

    // ======================================
    // OUTBOX ENCRYPTION
    // ======================================

    OUTBOX_ENCRYPTION_KEY_VERSION:
      z.coerce
        .number()
        .int()
        .positive(),

    OUTBOX_ENCRYPTION_KEY:
      z
        .string()
        .min(1)
        .refine(
          isExactly32BytesBase64,
          {
            message:
              "OUTBOX_ENCRYPTION_KEY must be Base64 that decodes to exactly 32 bytes.",
          }
        ),

    // ======================================
    // SMTP
    // ======================================

    SMTP_HOST:
      z
        .string()
        .min(1),

    SMTP_PORT:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(65535)
        .default(465),

    SMTP_SECURE:
      z
        .enum([
          "true",
          "false",
        ])
        .transform(
          (value) =>
            value ===
            "true"
        )
        .default("true"),

    SMTP_USER:
      z
        .string()
        .min(1),

    SMTP_PASSWORD:
      z
        .string()
        .min(1),

    MAIL_FROM:
      z
        .string()
        .min(1),

    // ======================================
    // LOGGING
    // ======================================

    LOG_LEVEL:
      z
        .enum([
          "fatal",
          "error",
          "warn",
          "info",
          "debug",
          "trace",
          "silent",
        ])
        .default("info"),
  });

const parsed =
  envSchema.safeParse(
    process.env
  );

if (!parsed.success) {
  console.error(
    "Invalid application configuration",
    parsed.error
      .flatten()
      .fieldErrors
  );

  process.exit(1);
}

module.exports =
  Object.freeze(
    parsed.data
  );