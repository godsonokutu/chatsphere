"use strict";

const express =
  require("express");

const authenticate =
  require("../middleware/authenticate");

const userController =
  require("../controllers/user.controller");

const {
  userSearchLimiter,
} =
  require("../middleware/rateLimiters");

const router =
  express.Router();

// ======================================================
// SEARCH USERS
// ======================================================

router.get(
  "/search",
  authenticate,
  userSearchLimiter,
  userController.searchUsers
);

module.exports =
  router;