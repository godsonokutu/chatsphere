"use strict";

const sequelize =
  require("../config/db");

const conversationRepository =
  require("../repositories/conversation.repository");

const userRepository =
  require("../repositories/user.repository");

const conversationValidator =
  require("../validators/conversation.validator");

const AppError =
  require("../errors/AppError");

const errorCodes =
  require("../errors/errorCodes");

const MAX_GROUP_MEMBERS =
  256;

// ======================================================
// LOCK AND VALIDATE GROUP CONTEXT
// ======================================================

async function getLockedGroupContext({
  conversationId,
  actorId,
  transaction,
}) {
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
    conversation.type !==
      "GROUP"
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .CONVERSATION_NOT_FOUND,

      statusCode:
        404,

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

      statusCode:
        404,

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

// ======================================================
// REQUIRE OWNER
// ======================================================

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

      statusCode:
        403,

      publicMessage:
        "You do not have permission to perform this action.",

      internalMessage:
        `Group operation requires OWNER role; user ${membership.userId} has ${membership.role}.`,
    });
  }
}

// ======================================================
// REQUIRE OWNER OR ADMIN
// ======================================================

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

      statusCode:
        403,

      publicMessage:
        "You do not have permission to perform this action.",

      internalMessage:
        `Group operation requires OWNER/ADMIN; user ${membership.userId} has ${membership.role}.`,
    });
  }
}

// ======================================================
// GET GROUP DETAILS
// ======================================================

async function getGroupDetails({
  conversationId,
  userId,
}) {
  const validConversationId =
    conversationValidator
      .validateConversationId(
        conversationId
      );

  const conversation =
    await conversationRepository
      .findConversationById(
        validConversationId
      );

  if (
    !conversation ||
    conversation.type !==
      "GROUP"
  ) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .CONVERSATION_NOT_FOUND,

      statusCode:
        404,

      publicMessage:
        "Conversation not found or unavailable.",

      internalMessage:
        `Group ${validConversationId} was not found.`,
    });
  }

  const membership =
    await conversationRepository
      .findMembership(
        validConversationId,
        userId
      );

  /*
   * Do not expose group information
   * to non-members.
   */
  if (!membership) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .CONVERSATION_NOT_FOUND,

      statusCode:
        404,

      publicMessage:
        "Conversation not found or unavailable.",

      internalMessage:
        `User ${userId} attempted to inspect unavailable group ${validConversationId}.`,
    });
  }

  const memberships =
    await conversationRepository
      .findActiveMembers(
        validConversationId
      );

  const memberIds =
    memberships.map(
      (member) =>
        String(
          member.userId
        )
    );

  const participants =
    memberIds.length > 0
      ? await userRepository
          .findConversationParticipantsByIds(
            memberIds
          )
      : [];

  const participantsById =
    new Map(
      participants.map(
        (
          participant
        ) => [
          String(
            participant.id
          ),

          participant,
        ]
      )
    );

  const rolePriority = {
    OWNER: 0,
    ADMIN: 1,
    MEMBER: 2,
  };

  const members =
    memberships
      .map(
        (
          member
        ) => {
          const id =
            String(
              member.userId
            );

          const participant =
            participantsById.get(
              id
            );

          return {
            id,

            username:
              participant
                ?.username ||
              "Unavailable user",

            role:
              member.role,
          };
        }
      )
      .sort(
        (
          first,
          second
        ) => {
          const roleDifference =
            (
              rolePriority[
                first.role
              ] ?? 99
            ) -
            (
              rolePriority[
                second.role
              ] ?? 99
            );

          if (
            roleDifference !==
            0
          ) {
            return roleDifference;
          }

          return first.username
            .localeCompare(
              second.username
            );
        }
      );

  return {
    id:
      String(
        conversation.id
      ),

    type:
      "GROUP",

    title:
      conversation.title,

    createdBy:
      conversation.createdBy
        ? String(
            conversation.createdBy
          )
        : null,

    currentUserRole:
      membership.role,

    memberCount:
      members.length,

    members,

    createdAt:
      conversation.createdAt,
  };
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

      statusCode:
        400,

      publicMessage:
        "You are already a member of this group.",

      internalMessage:
        `User ${actorId} attempted to add themselves to group ${validConversationId}.`,
    });
  }

  const participant =
    await userRepository
      .findConversationParticipantById(
        input.memberId
      );

  if (!participant) {
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .PARTICIPANT_UNAVAILABLE,

      statusCode:
        404,

      publicMessage:
        "The selected user cannot be added.",

      internalMessage:
        `Unavailable user ${input.memberId} requested for group ${validConversationId}.`,
    });
  }

  return sequelize.transaction(
    async (
      transaction
    ) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId,

          transaction,
        });

      requireAdminOrOwner(
        actorMembership
      );

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

      if (
        existing &&
        !existing.leftAt
      ) {
        return {
          added:
            false,

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

          statusCode:
            400,

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
            result.membership
              .role,
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
    async (
      transaction
    ) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId,

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

          statusCode:
            404,

          publicMessage:
            "Group member not found.",

          internalMessage:
            `Target ${validMemberId} is not active in group ${validConversationId}.`,
        });
      }

      /*
       * Owner cannot simply be removed.
       * Ownership must first be transferred.
       */
      if (
        target.role ===
        "OWNER"
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .OWNER_TRANSFER_REQUIRED,

          statusCode:
            409,

          publicMessage:
            "Group ownership must be transferred before the owner can leave.",

          internalMessage:
            `Attempted removal of owner ${validMemberId} from group ${validConversationId}.`,
        });
      }

      /*
       * ADMIN:
       * can remove MEMBER only.
       *
       * OWNER:
       * can remove MEMBER or ADMIN.
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

          statusCode:
            403,

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
// PROMOTE / DEMOTE GROUP MEMBER
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
    async (
      transaction
    ) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId,

          transaction,
        });

      /*
       * Only OWNER may promote
       * or demote administrators.
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

      if (
        !target ||
        target.role ===
          "OWNER"
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .GROUP_MEMBER_NOT_FOUND,

          statusCode:
            404,

          publicMessage:
            "Group member not found or unavailable.",

          internalMessage:
            `Role update target ${validMemberId} unavailable in group ${validConversationId}.`,
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
    async (
      transaction
    ) => {
      const {
        conversation,
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId,

          transaction,
        });

      requireOwner(
        actorMembership
      );

      await conversationRepository
        .updateGroupTitle(
          conversation,
          input.title,
          {
            transaction,
          }
        );

      return {
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
// TRANSFER GROUP OWNERSHIP
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

      statusCode:
        400,

      publicMessage:
        "Select another member for ownership transfer.",

      internalMessage:
        `Owner ${actorId} attempted to transfer ownership to themselves.`,
    });
  }

  return sequelize.transaction(
    async (
      transaction
    ) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId,

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

          statusCode:
            404,

          publicMessage:
            "The selected member cannot become owner.",

          internalMessage:
            `Ownership transfer target ${input.memberId} unavailable in group ${validConversationId}.`,
        });
      }

      /*
       * Both role changes are inside
       * the same transaction.
       *
       * Either both succeed or both
       * are rolled back.
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
    async (
      transaction
    ) => {
      const {
        actorMembership,
      } =
        await getLockedGroupContext({
          conversationId:
            validConversationId,

          actorId:
            userId,

          transaction,
        });

      /*
       * Owner cannot leave while still
       * owning the group.
       */
      if (
        actorMembership.role ===
        "OWNER"
      ) {
        throw new AppError({
          code:
            errorCodes.CONVERSATION
              .OWNER_TRANSFER_REQUIRED,

          statusCode:
            409,

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

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getGroupDetails,
  addGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
  renameGroup,
  transferGroupOwnership,
  leaveGroup,
};