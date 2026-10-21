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

const { createMobileAuthController } = require("../controllers/mobileAuth.controller");
const mobileAuth = createMobileAuthController(require("../services/auth.service"));

// Share limiter instances with browser routes so switching transports does not
// grant a fresh login/refresh quota. These routes never set refresh cookies.
router.post("/mobile/login", loginLimiter, mobileAuth.login);
router.post("/mobile/refresh", refreshLimiter, mobileAuth.refresh);

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
