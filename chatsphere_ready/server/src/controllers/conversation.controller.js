"use strict";

const conversationService =
  require("../services/conversation.service");

const groupManagementService =
  require("../services/groupManagement.service");

// ======================================================
// CREATE DIRECT
// ======================================================

async function createDirect(
  req,
  res,
  next
) {
  try {
    const result =
      await conversationService
        .createDirectConversation({
          currentUserId:
            req.auth.userId,

          participantId:
            req.body
              .participantId,
        });

    return res
      .status(
        result.created
          ? 201
          : 200
      )
      .json({
        success:
          true,

        message:
          result.created
            ? "Direct conversation created."
            : "Direct conversation already exists.",

        data:
          result.conversation,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// CREATE GROUP
// ======================================================

async function createGroup(
  req,
  res,
  next
) {
  try {
    const result =
      await conversationService
        .createGroupConversation({
          currentUserId:
            req.auth.userId,

          title:
            req.body.title,

          memberIds:
            req.body.memberIds,
        });

    return res
      .status(201)
      .json({
        success:
          true,

        message:
          "Group created successfully.",

        data:
          result.conversation,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// GET GROUP DETAILS
// ======================================================

async function getGroup(
  req,
  res,
  next
) {
  try {
    const result =
      await groupManagementService
        .getGroupDetails({
          conversationId:
            req.params
              .conversationId,

          userId:
            req.auth.userId,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// ADD MEMBER
// ======================================================

async function addGroupMember(
  req,
  res,
  next
) {
  try {
    const result =
      await groupManagementService
        .addGroupMember({
          conversationId:
            req.params
              .conversationId,

          actorId:
            req.auth.userId,

          memberId:
            req.body.memberId,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        message:
          result.added
            ? "Member added successfully."
            : "User is already a member.",

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// REMOVE MEMBER
// ======================================================

async function removeGroupMember(
  req,
  res,
  next
) {
  try {
    const result =
      await groupManagementService
        .removeGroupMember({
          conversationId:
            req.params
              .conversationId,

          actorId:
            req.auth.userId,

          memberId:
            req.params
              .memberId,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        message:
          "Member removed successfully.",

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// UPDATE ROLE
// ======================================================

async function updateGroupMemberRole(
  req,
  res,
  next
) {
  try {
    const result =
      await groupManagementService
        .updateGroupMemberRole({
          conversationId:
            req.params
              .conversationId,

          actorId:
            req.auth.userId,

          memberId:
            req.params
              .memberId,

          role:
            req.body.role,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        message:
          result.changed
            ? "Member role updated."
            : "Member already has this role.",

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// RENAME GROUP
// ======================================================

async function renameGroup(
  req,
  res,
  next
) {
  try {
    const result =
      await groupManagementService
        .renameGroup({
          conversationId:
            req.params
              .conversationId,

          actorId:
            req.auth.userId,

          title:
            req.body.title,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        message:
          "Group renamed successfully.",

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// TRANSFER OWNERSHIP
// ======================================================

async function transferGroupOwnership(
  req,
  res,
  next
) {
  try {
    const result =
      await groupManagementService
        .transferGroupOwnership({
          conversationId:
            req.params
              .conversationId,

          actorId:
            req.auth.userId,

          memberId:
            req.body.memberId,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        message:
          "Group ownership transferred successfully.",

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

// ======================================================
// LEAVE GROUP
// ======================================================

async function leaveGroup(
  req,
  res,
  next
) {
  try {
    const result =
      await groupManagementService
        .leaveGroup({
          conversationId:
            req.params
              .conversationId,

          userId:
            req.auth.userId,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        message:
          "You left the group.",

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

module.exports = {
  createDirect,
  createGroup,
  getGroup,
  addGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
  renameGroup,
  transferGroupOwnership,
  leaveGroup,
};