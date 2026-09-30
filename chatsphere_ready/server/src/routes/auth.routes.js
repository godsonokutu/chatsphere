"use strict";

const express =
  require("express");

const authenticate =
  require("../middleware/authenticate");

const authController =
  require(
    "../controllers/auth.controller"
  );

const {
  loginLimiter,
  registrationLimiter,
  verificationLimiter,
  resendVerificationLimiter,
  refreshLimiter,
} =
  require("../middleware/rateLimiters");

const router =
  express.Router();

// ======================================================
// REGISTER
// ======================================================

router.post(
  "/register",
  registrationLimiter,
  authController.register
);

// ======================================================
// RESEND VERIFICATION CODE
// ======================================================

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  authController.resendVerification
);

// ======================================================
// VERIFY ACCOUNT
// ======================================================

router.post(
  "/verify",
  verificationLimiter,
  authController.verifyAccount
);

// ======================================================
// LOGIN
// ======================================================

router.post(
  "/login",
  loginLimiter,
  authController.login
);

// ======================================================
// REFRESH SESSION
// ======================================================

router.post(
  "/refresh",
  refreshLimiter,
  authController.refreshSession
);

// ======================================================
// LOGOUT
// ======================================================

router.post(
  "/logout",
  authenticate,
  authController.logout
);

module.exports =
  router;