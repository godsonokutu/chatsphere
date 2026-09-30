"use strict";

const conversationQueryRepository =
  require("../repositories/conversationQuery.repository");

const {
  encodeConversationCursor,
  decodeConversationCursor,
} =
  require("../utils/conversationCursor");


const {
  UniqueConstraintError,
} = require("sequelize");

const sequelize =
  require("../config/db");

const conversationRepository =
  require("../repositories/conversation.repository");

const userRepository =
  require("../repositories/user.repository");

const conversationValidator =
  require("../validators/conversation.validator");

const {
  createDirectKey,
} = require("../utils/conversation");

const AppError =
  require("../errors/AppError");

const errorCodes =
  require("../errors/errorCodes");

const MAX_GROUP_MEMBERS = 256;

// ======================================================
// DIRECT CONVERSATION
// ======================================================

async function createDirectConversation({
  currentUserId,
  participantId,
}) {
  const input =
    conversationValidator
      .validateCreateDirectConversation({
        participantId,
      });

  const currentId =
    String(currentUserId);

  const targetId =
    String(input.participantId);

  // --------------------------------------------------
  // Prevent self conversation
  // --------------------------------------------------

  if (currentId === targetId) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .SELF_CONVERSATION_NOT_ALLOWED,

      statusCode: 400,

      publicMessage:
        "You cannot start a direct conversation with yourself.",

      internalMessage:
        `User ${currentId} attempted self conversation.`,
    });
  }

  // --------------------------------------------------
  // Target user must exist and be ACTIVE
  // --------------------------------------------------

  const participant =
    await userRepository
      .findConversationParticipantById(
        targetId
      );

  if (!participant) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .PARTICIPANT_UNAVAILABLE,

      statusCode: 404,

      publicMessage:
        "Unable to start a conversation with this user.",

      internalMessage:
        `Conversation participant ${targetId} unavailable.`,
    });
  }

  // --------------------------------------------------
  // Canonical unique key
  // --------------------------------------------------

  const directKey =
    createDirectKey(
      currentId,
      targetId
    );

  // --------------------------------------------------
  // Fast duplicate check
  // --------------------------------------------------

  const existing =
    await conversationRepository
      .findDirectByKey(
        directKey
      );

  if (existing) {
    return {
      created: false,

      conversation: {
        id:
          String(existing.id),

        type:
          existing.type,

        participant: {
          id:
            String(
              participant.id
            ),

          username:
            participant.username,
        },

        createdAt:
          existing.createdAt,
      },
    };
  }

  let conversation;

  try {
    conversation =
      await sequelize.transaction(
        async (transaction) => {
          /*
           * Recheck inside transaction.
           */
          const insideExisting =
            await conversationRepository
              .findDirectByKey(
                directKey,
                {
                  transaction,
                }
              );

          if (insideExisting) {
            return {
              record:
                insideExisting,

              created: false,
            };
          }

          const created =
            await conversationRepository
              .createDirectConversation(
                {
                  directKey,

                  createdBy:
                    currentId,
                },
                {
                  transaction,
                }
              );

          await conversationRepository
            .addMembers(
              created.id,
              [
                currentId,
                targetId,
              ],
              {
                transaction,
              }
            );

          return {
            record:
              created,

            created:
              true,
          };
        }
      );
  } catch (error) {
    /*
     * Database uniqueness is the final
     * concurrency protection.
     */
    if (
      error instanceof
      UniqueConstraintError
    ) {
      const concurrentConversation =
        await conversationRepository
          .findDirectByKey(
            directKey
          );

      if (
        concurrentConversation
      ) {
        conversation = {
          record:
            concurrentConversation,

          created:
            false,
        };
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  return {
    created:
      conversation.created,

    conversation: {
      id:
        String(
          conversation.record.id
        ),

      type:
        conversation.record.type,

      participant: {
        id:
          String(
            participant.id
          ),

        username:
          participant.username,
      },

      createdAt:
        conversation.record
          .createdAt,
    },
  };
}

// ======================================================
// CREATE GROUP
// ======================================================

async function createGroupConversation({
  currentUserId,
  title,
  memberIds,
}) {
  const input =
    conversationValidator
      .validateCreateGroupConversation({
        title,
        memberIds,
      });

  const creatorId =
    String(currentUserId);

  // --------------------------------------------------
  // Normalize and deduplicate
  // --------------------------------------------------

  const uniqueMemberIds =
    [
      ...new Set(
        input.memberIds.map(
          String
        )
      ),
    ];

  /*
   * Creator automatically becomes OWNER.
   * Remove creator if supplied in memberIds.
   */
  const targetIds =
    uniqueMemberIds.filter(
      (userId) =>
        userId !== creatorId
    );

  if (
    targetIds.length === 0
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .INVALID_GROUP_MEMBERS,

      statusCode: 400,

      publicMessage:
        "A group must contain at least one other member.",

      internalMessage:
        `User ${creatorId} attempted to create a group without another participant.`,
    });
  }

  if (
    targetIds.length + 1 >
    MAX_GROUP_MEMBERS
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .GROUP_MEMBER_LIMIT_EXCEEDED,

      statusCode: 400,

      publicMessage:
        "The group member limit has been exceeded.",

      internalMessage:
        `Group creation attempted with ${
          targetIds.length + 1
        } users.`,
    });
  }

  // --------------------------------------------------
  // Verify every requested user
  // --------------------------------------------------

  const participants =
    await userRepository
      .findConversationParticipantsByIds(
        targetIds
      );

  const foundIds =
    new Set(
      participants.map(
        (participant) =>
          String(
            participant.id
          )
      )
    );

  const allValid =
    targetIds.every(
      (userId) =>
        foundIds.has(
          userId
        )
    );

  if (!allValid) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .INVALID_GROUP_MEMBERS,

      statusCode: 400,

      publicMessage:
        "One or more selected users cannot be added to the group.",

      internalMessage:
        `Group creation by user ${creatorId} contained unavailable participant IDs.`,
    });
  }

  // --------------------------------------------------
  // Create group atomically
  // --------------------------------------------------

  const conversation =
    await sequelize.transaction(
      async (transaction) => {
        const created =
          await conversationRepository
            .createGroupConversation(
              {
                title:
                  input.title,

                createdBy:
                  creatorId,
              },
              {
                transaction,
              }
            );

        const memberships = [
          {
            userId:
              creatorId,

            role:
              "OWNER",
          },

          ...targetIds.map(
            (userId) => ({
              userId,

              role:
                "MEMBER",
            })
          ),
        ];

        await conversationRepository
          .addGroupMembers(
            created.id,
            memberships,
            {
              transaction,
            }
          );

        return created;
      }
    );

  return {
    conversation: {
      id:
        String(
          conversation.id
        ),

      type:
        conversation.type,

      title:
        conversation.title,

      createdBy:
        String(
          conversation.createdBy
        ),

      memberCount:
        targetIds.length + 1,

      createdAt:
        conversation.createdAt,
    },
  };
}

// ======================================================
// GROUP AUTHORIZATION HELPERS
// ======================================================

async function getLockedGroupContext({
  conversationId,
  actorId,
  transaction,
}) {
  /*
   * Locking the conversation row serializes
   * administrative mutations for this group.
   */
  const conversation =
    await conversationRepository
      .findConversationById(
        conversationId,
        {
          transaction,
          lock: true,
        }
      );

  if (
    !conversation ||
    conversation.type !== "GROUP"
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .CONVERSATION_NOT_FOUND,

      statusCode: 404,

      publicMessage:
        "Conversation not found or unavailable.",

      internalMessage:
        `Group operation attempted on unavailable conversation ${conversationId}.`,
    });
  }

  const actorMembership =
    await conversationRepository
      .findMembership(
        conversationId,
        actorId,
        {
          transaction,
          lock: true,
        }
      );

  if (!actorMembership) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .CONVERSATION_NOT_FOUND,

      statusCode: 404,

      publicMessage:
        "Conversation not found or unavailable.",

      internalMessage:
        `User ${actorId} is not an active member of group ${conversationId}.`,
    });
  }

  return {
    conversation,
    actorMembership,
  };
}

function requireOwner(
  membership
) {
  if (
    membership.role !==
    "OWNER"
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .INSUFFICIENT_GROUP_PERMISSION,

      statusCode: 403,

      publicMessage:
        "You do not have permission to perform this action.",

      internalMessage:
        `Group operation requires OWNER role; user ${membership.userId} has ${membership.role}.`,
    });
  }
}

function requireAdminOrOwner(
  membership
) {
  if (
    membership.role !==
      "OWNER" &&
    membership.role !==
      "ADMIN"
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .INSUFFICIENT_GROUP_PERMISSION,

      statusCode: 403,

      publicMessage:
        "You do not have permission to perform this action.",

      internalMessage:
        `Group operation requires OWNER/ADMIN; user ${membership.userId} has ${membership.role}.`,
    });
  }
}

// ======================================================
// ADD GROUP MEMBER
// ======================================================

async function addGroupMember({
  conversationId,
  actorId,
  memberId,
}) {
  const validConversationId =
    conversationValidator
      .validateConversationId(
        conversationId
      );

  const input =
    conversationValidator
      .validateAddGroupMember({
        memberId,
      });

  if (
    String(actorId) ===
    String(input.memberId)
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .INVALID_GROUP_MEMBERS,

      statusCode: 400,

      publicMessage:
        "You are already a member of this group.",

      internalMessage:
        `User ${actorId} attempted to add themselves to group ${validConversationId}.`,
    });
  }

  return sequelize.transaction(
    async (transaction) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId:
            String(actorId),

          transaction,
        });

      requireAdminOrOwner(
        actorMembership
      );

      /*
       * Validate target user inside the
       * transaction so membership mutation
       * uses current account state.
       */
      const participant =
        await userRepository
          .findConversationParticipantById(
            input.memberId,
            {
              transaction,
              lock: true,
            }
          );

      if (!participant) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .PARTICIPANT_UNAVAILABLE,

          statusCode: 404,

          publicMessage:
            "The selected user cannot be added.",

          internalMessage:
            `Unavailable user ${input.memberId} requested for group ${validConversationId}.`,
        });
      }

      const existing =
        await conversationRepository
          .findMembershipIncludingLeft(
            validConversationId,
            input.memberId,
            {
              transaction,
              lock: true,
            }
          );

      /*
       * Idempotent add.
       */
      if (
        existing &&
        !existing.leftAt
      ) {
        return {
          added: false,

          member: {
            id:
              String(
                participant.id
              ),

            username:
              participant.username,

            role:
              existing.role,
          },
        };
      }

      const activeCount =
        await conversationRepository
          .countActiveMembers(
            validConversationId,
            {
              transaction,
            }
          );

      if (
        activeCount >=
        MAX_GROUP_MEMBERS
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .GROUP_MEMBER_LIMIT_EXCEEDED,

          statusCode: 400,

          publicMessage:
            "The group member limit has been reached.",

          internalMessage:
            `Group ${validConversationId} already has ${activeCount} active members.`,
        });
      }

      const result =
        await conversationRepository
          .addOrReactivateMember(
            validConversationId,
            input.memberId,
            {
              transaction,
            }
          );

      return {
        added:
          result.created,

        member: {
          id:
            String(
              participant.id
            ),

          username:
            participant.username,

          role:
            result.membership.role,
        },
      };
    }
  );
}

// ======================================================
// REMOVE GROUP MEMBER
// ======================================================

async function removeGroupMember({
  conversationId,
  actorId,
  memberId,
}) {
  const validConversationId =
    conversationValidator
      .validateConversationId(
        conversationId
      );

  const validMemberId =
    conversationValidator
      .validateMemberId(
        memberId
      );

  return sequelize.transaction(
    async (transaction) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId:
            String(actorId),

          transaction,
        });

      requireAdminOrOwner(
        actorMembership
      );

      const target =
        await conversationRepository
          .findMembership(
            validConversationId,
            validMemberId,
            {
              transaction,
              lock: true,
            }
          );

      if (!target) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .GROUP_MEMBER_NOT_FOUND,

          statusCode: 404,

          publicMessage:
            "Group member not found.",

          internalMessage:
            `Target ${validMemberId} is not an active member of group ${validConversationId}.`,
        });
      }

      /*
       * Owner cannot be removed.
       */
      if (
        target.role ===
        "OWNER"
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .OWNER_TRANSFER_REQUIRED,

          statusCode: 409,

          publicMessage:
            "Group ownership must be transferred before the owner can leave.",

          internalMessage:
            `Attempted removal of owner ${validMemberId} from group ${validConversationId}.`,
        });
      }

      /*
       * ADMIN may remove MEMBER only.
       *
       * OWNER may remove MEMBER or ADMIN.
       */
      if (
        actorMembership.role ===
          "ADMIN" &&
        target.role !==
          "MEMBER"
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .INSUFFICIENT_GROUP_PERMISSION,

          statusCode: 403,

          publicMessage:
            "You do not have permission to remove this member.",

          internalMessage:
            `Admin ${actorId} attempted to remove ${target.role} ${validMemberId}.`,
        });
      }

      await conversationRepository
        .deactivateMembership(
          target,
          {
            transaction,
          }
        );

      return {
        removed:
          true,

        memberId:
          String(
            validMemberId
          ),
      };
    }
  );
}

// ======================================================
// PROMOTE / DEMOTE MEMBER
// ======================================================

async function updateGroupMemberRole({
  conversationId,
  actorId,
  memberId,
  role,
}) {
  const validConversationId =
    conversationValidator
      .validateConversationId(
        conversationId
      );

  const validMemberId =
    conversationValidator
      .validateMemberId(
        memberId
      );

  const input =
    conversationValidator
      .validateUpdateGroupRole({
        role,
      });

  return sequelize.transaction(
    async (transaction) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId:
            String(actorId),

          transaction,
        });

      /*
       * Only OWNER may promote/demote.
       */
      requireOwner(
        actorMembership
      );

      const target =
        await conversationRepository
          .findMembership(
            validConversationId,
            validMemberId,
            {
              transaction,
              lock: true,
            }
          );

      if (!target) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .GROUP_MEMBER_NOT_FOUND,

          statusCode: 404,

          publicMessage:
            "Group member not found or unavailable.",

          internalMessage:
            `Role update target ${validMemberId} unavailable in group ${validConversationId}.`,
        });
      }

      /*
       * Ownership is changed only through the
       * dedicated ownership-transfer operation.
       */
      if (
        target.role ===
        "OWNER"
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .GROUP_ACTION_NOT_ALLOWED,

          statusCode: 409,

          publicMessage:
            "The group owner's role cannot be changed directly.",

          internalMessage:
            `Direct role modification attempted for owner ${validMemberId} in group ${validConversationId}.`,
        });
      }

      if (
        target.role ===
        input.role
      ) {
        return {
          changed:
            false,

          memberId:
            String(
              validMemberId
            ),

          role:
            target.role,
        };
      }

      await conversationRepository
        .updateMembershipRole(
          target,
          input.role,
          {
            transaction,
          }
        );

      return {
        changed:
          true,

        memberId:
          String(
            validMemberId
          ),

        role:
          input.role,
      };
    }
  );
}

// ======================================================
// RENAME GROUP
// ======================================================

async function renameGroup({
  conversationId,
  actorId,
  title,
}) {
  const validConversationId =
    conversationValidator
      .validateConversationId(
        conversationId
      );

  const input =
    conversationValidator
      .validateRenameGroup({
        title,
      });

  return sequelize.transaction(
    async (transaction) => {
      const {
        conversation,
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId:
            String(actorId),

          transaction,
        });

      /*
       * Current policy:
       * only OWNER may rename the group.
       */
      requireOwner(
        actorMembership
      );

      if (
        conversation.title ===
        input.title
      ) {
        return {
          changed:
            false,

          conversationId:
            String(
              conversation.id
            ),

          title:
            conversation.title,
        };
      }

      await conversationRepository
        .updateGroupTitle(
          conversation,
          input.title,
          {
            transaction,
          }
        );

      return {
        changed:
          true,

        conversationId:
          String(
            conversation.id
          ),

        title:
          conversation.title,
      };
    }
  );
}

// ======================================================
// TRANSFER OWNERSHIP
// ======================================================

async function transferGroupOwnership({
  conversationId,
  actorId,
  memberId,
}) {
  const validConversationId =
    conversationValidator
      .validateConversationId(
        conversationId
      );

  const input =
    conversationValidator
      .validateTransferOwnership({
        memberId,
      });

  if (
    String(actorId) ===
    String(input.memberId)
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .INVALID_OWNERSHIP_TRANSFER,

      statusCode: 400,

      publicMessage:
        "Select another member for ownership transfer.",

      internalMessage:
        `Owner ${actorId} attempted ownership transfer to self.`,
    });
  }

  return sequelize.transaction(
    async (transaction) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId:
            String(actorId),

          transaction,
        });

      requireOwner(
        actorMembership
      );

      const target =
        await conversationRepository
          .findMembership(
            validConversationId,
            input.memberId,
            {
              transaction,
              lock: true,
            }
          );

      if (!target) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .GROUP_MEMBER_NOT_FOUND,

          statusCode: 404,

          publicMessage:
            "The selected member cannot become owner.",

          internalMessage:
            `Ownership transfer target ${input.memberId} unavailable in group ${validConversationId}.`,
        });
      }

      /*
       * Ownership changes atomically:
       *
       * old owner -> MEMBER
       * selected member -> OWNER
       */
      await conversationRepository
        .updateMembershipRole(
          actorMembership,
          "MEMBER",
          {
            transaction,
          }
        );

      await conversationRepository
        .updateMembershipRole(
          target,
          "OWNER",
          {
            transaction,
          }
        );

      return {
        conversationId:
          String(
            validConversationId
          ),

        previousOwnerId:
          String(
            actorId
          ),

        ownerId:
          String(
            target.userId
          ),
      };
    }
  );
}

// ======================================================
// LEAVE GROUP
// ======================================================

async function leaveGroup({
  conversationId,
  userId,
}) {
  const validConversationId =
    conversationValidator
      .validateConversationId(
        conversationId
      );

  return sequelize.transaction(
    async (transaction) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId:
            String(userId),

          transaction,
        });

      /*
       * Owner must transfer ownership first.
       */
      if (
        actorMembership.role ===
        "OWNER"
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .OWNER_TRANSFER_REQUIRED,

          statusCode: 409,

          publicMessage:
            "Transfer group ownership before leaving the group.",

          internalMessage:
            `Owner ${userId} attempted to leave group ${validConversationId}.`,
        });
      }

      await conversationRepository
        .deactivateMembership(
          actorMembership,
          {
            transaction,
          }
        );

      return {
        left:
          true,

        conversationId:
          String(
            validConversationId
          ),
      };
    }
  );
}

async function listConversations({
  userId,
  cursor,
  limit,
}) {
  const input =
    conversationValidator
      .validateConversationList({
        cursor,
        limit,
      });

  let decodedCursor = null;

  if (input.cursor) {
    try {
      decodedCursor =
        decodeConversationCursor(
          input.cursor
        );
    } catch (error) {
      throw new AppError({
        code:
          errorCodes.VALIDATION
            .INVALID_INPUT,

        statusCode: 400,

        publicMessage:
          "Invalid pagination cursor.",

        internalMessage:
          "Conversation pagination cursor could not be decoded.",

        cause: error,
      });
    }
  }

  const rows =
    await conversationQueryRepository
      .listForUser({
        userId:
          String(userId),

        limit:
          input.limit,

        cursor:
          decodedCursor,
      });

  const hasMore =
    rows.length >
    input.limit;

  const page =
    hasMore
      ? rows.slice(
          0,
          input.limit
        )
      : rows;

  const conversations =
    page.map(
      (row) => {
        const isDirect =
          row.type ===
          "DIRECT";

        return {
          id:
            String(row.id),

          type:
            row.type,

          title:
            row.type ===
            "GROUP"
              ? row.title
              : null,

          currentUserRole:
            row.currentUserRole,

          participant:
            isDirect
              ? {
                  id:
                    row.participantId
                      ? String(
                          row.participantId
                        )
                      : null,

                  username:
                    row.participantUsername ||
                    null,

                  lastSeenAt:
                    row.participantLastSeenAt ||
                    null,
                }
              : null,

          memberCount:
            row.type ===
            "GROUP"
              ? Number(
                  row.memberCount
                )
              : null,

          unreadCount:
            Number(
              row.unreadCount ||
              0
            ),

          lastMessage:
            row.lastMessageId
              ? {
                  id:
                    String(
                      row.lastMessageId
                    ),

                  senderId:
                    row.lastMessageSenderId
                      ? String(
                          row.lastMessageSenderId
                        )
                      : null,

                  type:
                    row.lastMessageType,

                  content:
                    row.lastMessageContent,

                  deleted:
                    Boolean(
                      row.lastMessageDeletedAt
                    ),

                  createdAt:
                    row.lastMessageCreatedAt,
                }
              : null,

          joinedAt:
            row.joinedAt,

          sortAt:
            row.sortAt,
        };
      }
    );

  let nextCursor = null;

  if (
    hasMore &&
    page.length > 0
  ) {
    const last =
      page[
        page.length - 1
      ];

    nextCursor =
      encodeConversationCursor({
        sortAt:
          last.sortAt,

        id:
          last.id,
      });
  }

  return {
    conversations,

    pagination: {
      hasMore,

      nextCursor,

      limit:
        input.limit,
    },
  };
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createDirectConversation,

  createGroupConversation,

  addGroupMember,

  removeGroupMember,

  updateGroupMemberRole,

  renameGroup,

  transferGroupOwnership,

  leaveGroup,

  listConversations,

  
};