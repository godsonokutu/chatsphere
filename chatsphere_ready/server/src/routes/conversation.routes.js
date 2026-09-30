"use strict";

const conversationInboxController =
  require("../controllers/conversationInbox.controller");

const express =
  require("express");

const authenticate =
  require("../middleware/authenticate");

const conversationController =
  require("../controllers/conversation.controller");

const messageController =
  require("../controllers/message.controller");

const router =
  express.Router();

// ======================================================
// CREATE CONVERSATIONS
// ======================================================

router.post(
  "/direct",
  authenticate,
  conversationController
    .createDirect
);

router.post(
  "/group",
  authenticate,
  conversationController
    .createGroup
);

// ======================================================
// CONVERSATION INBOX
// ======================================================

router.get(
  "/",
  authenticate,
  conversationInboxController
    .listConversations
);

// ======================================================
// GROUP DETAILS
// ======================================================

router.get(
  "/:conversationId/group",
  authenticate,
  conversationController
    .getGroup
);

// ======================================================
// RENAME GROUP
// ======================================================

router.patch(
  "/:conversationId/group",
  authenticate,
  conversationController
    .renameGroup
);

// ======================================================
// ADD GROUP MEMBER
// ======================================================

router.post(
  "/:conversationId/members",
  authenticate,
  conversationController
    .addGroupMember
);

// ======================================================
// REMOVE GROUP MEMBER
// ======================================================

router.delete(
  "/:conversationId/members/:memberId",
  authenticate,
  conversationController
    .removeGroupMember
);

// ======================================================
// PROMOTE / DEMOTE GROUP MEMBER
// ======================================================

router.patch(
  "/:conversationId/members/:memberId/role",
  authenticate,
  conversationController
    .updateGroupMemberRole
);

// ======================================================
// TRANSFER OWNERSHIP
// ======================================================

router.post(
  "/:conversationId/owner-transfer",
  authenticate,
  conversationController
    .transferGroupOwnership
);

// ======================================================
// LEAVE GROUP
// ======================================================

router.post(
  "/:conversationId/leave",
  authenticate,
  conversationController
    .leaveGroup
);

// ======================================================
// MESSAGES
// ======================================================

router.post(
  "/:conversationId/messages",
  authenticate,
  messageController.sendMessage
);

router.get(
  "/:conversationId/messages",
  authenticate,
  messageController.getMessages
);

module.exports =
  router;