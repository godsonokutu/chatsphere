"use strict";

const {
  rateLimit,
} = require("express-rate-limit");

// ======================================================
// COMMON RESPONSE
// ======================================================

function rateLimitHandler(
  req,
  res
) {
  return res
    .status(429)
    .json({
      success: false,

      error: {
        code:
          "RATE_LIMITED",

        message:
          "Too many requests. Please try again later.",
      },

      requestId:
        req.id ||
        null,
    });
}

// ======================================================
// LOGIN
//
// Counts failed login attempts.
// Successful logins do not consume the quota.
// ======================================================

const loginLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      10,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    skipSuccessfulRequests:
      true,

    handler:
      rateLimitHandler,
  });

// ======================================================
// REGISTRATION
// ======================================================

const registrationLimiter =
  rateLimit({
    windowMs:
      60 * 60 * 1000,

    limit:
      5,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    handler:
      rateLimitHandler,
  });

// ======================================================
// OTP / VERIFICATION ATTEMPTS
// ======================================================

const verificationLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      10,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    handler:
      rateLimitHandler,
  });

// ======================================================
// RESEND VERIFICATION CODE
// ======================================================

const resendVerificationLimiter =
  rateLimit({
    windowMs:
      60 * 60 * 1000,

    limit:
      5,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    handler:
      rateLimitHandler,
  });

// ======================================================
// REFRESH TOKEN
//
// Higher limit because a legitimate client may refresh
// during reconnection or multi-tab activity.
// ======================================================

const refreshLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit:
      60,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    handler:
      rateLimitHandler,
  });

// ======================================================
// USER SEARCH
// ======================================================

const userSearchLimiter =
  rateLimit({
    windowMs:
      60 * 1000,

    limit:
      60,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    /*
     * Search is authenticated.
     * Limit each account independently instead
     * of grouping multiple users behind one IP.
     */
    keyGenerator:
      (req) =>
        String(
          req.auth.userId
        ),

    handler:
      rateLimitHandler,
  });

module.exports = {
  loginLimiter,
  registrationLimiter,
  verificationLimiter,
  resendVerificationLimiter,
  refreshLimiter,
  userSearchLimiter,
};