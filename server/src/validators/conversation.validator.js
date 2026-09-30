"use strict";

const { z } = require("zod");

const participantIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[1-9]\d{0,19}$/,
      "participantId must be a valid user ID"
    )
    .refine(
      (value) => {
        try {
          const parsed =
            BigInt(value);

          return (
            parsed <=
            18446744073709551615n
          );
        } catch {
          return false;
        }
      },
      {
        message:
          "participantId is outside the supported range",
      }
    );

const MAX_GROUP_MEMBERS = 256;

const groupTitleSchema =
  z
    .string()
    .trim()
    .min(1, "Group title is required")
    .max(120, "Group title is too long");

const conversationIdSchema =
  participantIdSchema;

const groupRoleSchema =
  z.enum([
    "ADMIN",
    "MEMBER",
  ]);

const addGroupMemberSchema =
  z.object({
    memberId:
      participantIdSchema,
  });

const updateGroupRoleSchema =
  z.object({
    role:
      groupRoleSchema,
  });

const renameGroupSchema =
  z.object({
    title:
      groupTitleSchema,
  });

const transferOwnershipSchema =
  z.object({
    memberId:
      participantIdSchema,
  });

function validateConversationId(
  value
) {
  return conversationIdSchema.parse(
    String(value)
  );
}

function validateMemberId(
  value
) {
  return participantIdSchema.parse(
    String(value)
  );
}

function validateAddGroupMember(
  input
) {
  return addGroupMemberSchema.parse(
    input
  );
}

function validateUpdateGroupRole(
  input
) {
  return updateGroupRoleSchema.parse(
    input
  );
}

function validateRenameGroup(
  input
) {
  return renameGroupSchema.parse(
    input
  );
}

function validateTransferOwnership(
  input
) {
  return transferOwnershipSchema.parse(
    input
  );
}

const createGroupConversationSchema =
  z
    .object({
      title:
        groupTitleSchema,

      memberIds:
        z
          .array(participantIdSchema)
          .min(
            1,
            "At least one member is required"
          )
          .max(
            MAX_GROUP_MEMBERS - 1,
            `A group may contain at most ${MAX_GROUP_MEMBERS} users`
          ),
    });

const conversationListSchema =
  z.object({
    cursor:
      z
        .string()
        .trim()
        .min(1)
        .max(512)
        .optional(),

    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(30),
  });

const createDirectConversationSchema =
  z.object({
    participantId:
      participantIdSchema,
  });

function validateCreateDirectConversation(
  input
) {
  return createDirectConversationSchema.parse(
    input
  );
}

function validateCreateGroupConversation(
  input
) {
  return createGroupConversationSchema.parse(
    input
  );
}

function validateConversationList(
  input
) {
  return conversationListSchema.parse(
    input
  );
}

module.exports = {
  validateCreateDirectConversation,
  validateCreateGroupConversation,
  validateConversationId,
  validateMemberId,
  validateAddGroupMember,
  validateUpdateGroupRole,
  validateRenameGroup,
  validateTransferOwnership,
  validateConversationList,

};