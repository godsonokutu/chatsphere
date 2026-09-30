"use strict";

const { QueryTypes } = require("sequelize");

const sequelize =
  require("../config/db");

const Conversation =
  require("../models/Conversation");

const ConversationMember =
  require("../models/ConversationMember");

// ==========================================
// DIRECT CONVERSATION
// ==========================================

async function findDirectByKey(
  directKey,
  options = {}
) {
  return Conversation.findOne({
    where: {
      type: "DIRECT",
      directKey,
    },

    transaction:
      options.transaction,
  });
}

async function createDirectConversation(
  {
    directKey,
    createdBy,
  },
  options = {}
) {
  return Conversation.create(
    {
      type: "DIRECT",

      directKey,

      title: null,

      createdBy,

      lastMessageAt: null,
    },
    {
      transaction:
        options.transaction,
    }
  );
}

// ==========================================
// MEMBERSHIP
// ==========================================

async function addMembers(
  conversationId,
  userIds,
  options = {}
) {
  const now =
    new Date();

  const rows =
    userIds.map(
      (userId) => ({
        conversationId,

        userId,

        role: "MEMBER",

        joinedAt: now,

        leftAt: null,
      })
    );

  return ConversationMember.bulkCreate(
    rows,
    {
      transaction:
        options.transaction,
    }
  );
}

async function findMembership(
  conversationId,
  userId,
  options = {}
) {
  const queryOptions = {
    where: {
      conversationId,
      userId,
      leftAt: null,
    },

    transaction:
      options.transaction,
  };

  if (
    options.lock &&
    options.transaction
  ) {
    queryOptions.lock =
      options.transaction
        .LOCK.UPDATE;
  }

  return ConversationMember.findOne(
    queryOptions
  );
}

async function findMembershipIncludingLeft(
  conversationId,
  userId,
  options = {}
) {
  const queryOptions = {
    where: {
      conversationId,
      userId,
    },

    transaction:
      options.transaction,
  };

  if (
    options.lock &&
    options.transaction
  ) {
    queryOptions.lock =
      options.transaction
        .LOCK.UPDATE;
  }

  return ConversationMember.findOne(
    queryOptions
  );
}

async function findActiveMembers(
  conversationId,
  options = {}
) {
  return ConversationMember.findAll({
    where: {
      conversationId,
      leftAt: null,
    },

    attributes: [
      "userId",
      "role",
    ],

    transaction:
      options.transaction,
  });
}

async function countActiveMembers(
  conversationId,
  options = {}
) {
  return ConversationMember.count({
    where: {
      conversationId,
      leftAt: null,
    },

    transaction:
      options.transaction,
  });
}

// ==========================================
// READ CURSOR
// ==========================================

async function updateReadCursor(
  membership,
  {
    lastReadMessageId,
    lastReadAt,
  },
  options = {}
) {
  membership.lastReadMessageId =
    lastReadMessageId;

  membership.lastReadAt =
    lastReadAt;

  return membership.save({
    transaction:
      options.transaction,
  });
}

// ==========================================
// PRESENCE / RELATED USERS
// ==========================================

async function findRelatedUserIds(
  userId,
  options = {}
) {
  const rows =
    await sequelize.query(
      `
      SELECT DISTINCT
        cm2.user_id AS userId
      FROM conversation_members cm1

      INNER JOIN conversation_members cm2
        ON cm2.conversation_id =
           cm1.conversation_id

      WHERE
        cm1.user_id = :userId
        AND cm1.left_at IS NULL
        AND cm2.left_at IS NULL
        AND cm2.user_id <> :userId
      `,
      {
        replacements: {
          userId,
        },

        type:
          QueryTypes.SELECT,

        transaction:
          options.transaction,
      }
    );

  return rows.map(
    (row) =>
      String(row.userId)
  );
}

// ==========================================
// GROUP CONVERSATION
// ==========================================

async function createGroupConversation(
  {
    title,
    createdBy,
  },
  options = {}
) {
  return Conversation.create(
    {
      type: "GROUP",

      directKey: null,

      title,

      createdBy,

      lastMessageAt: null,
    },
    {
      transaction:
        options.transaction,
    }
  );
}

async function addGroupMembers(
  conversationId,
  members,
  options = {}
) {
  const now =
    new Date();

  const rows =
    members.map(
      ({
        userId,
        role,
      }) => ({
        conversationId,

        userId,

        role,

        joinedAt: now,

        leftAt: null,
      })
    );

  return ConversationMember.bulkCreate(
    rows,
    {
      transaction:
        options.transaction,
    }
  );
}

// ==========================================
// GROUP ADMINISTRATION REPOSITORY HELPERS
// ==========================================

async function findConversationById(
  conversationId,
  options = {}
) {
  const queryOptions = {
    where: {
      id: conversationId,
    },

    transaction:
      options.transaction,
  };

  if (
    options.lock &&
    options.transaction
  ) {
    queryOptions.lock =
      options.transaction
        .LOCK.UPDATE;
  }

  return Conversation.findOne(
    queryOptions
  );
}

async function addOrReactivateMember(
  conversationId,
  userId,
  options = {}
) {
  const existing =
    await findMembershipIncludingLeft(
      conversationId,
      userId,
      {
        transaction:
          options.transaction,

        lock:
          Boolean(
            options.transaction
          ),
      }
    );

  if (
    existing &&
    !existing.leftAt
  ) {
    return {
      created: false,

      membership:
        existing,
    };
  }

  const now =
    new Date();

  if (existing) {
  existing.role = "MEMBER";

  existing.joinedAt = now;

  existing.leftAt = null;

  /*
   * New membership period.
   * Do not carry the previous read cursor
   * into the new membership window.
   */
  existing.lastReadMessageId = null;

  existing.lastReadAt = null;

  await existing.save({
    transaction:
      options.transaction,
  });

  return {
    created: true,
    membership: existing,
  };
}

  const membership =
    await ConversationMember.create(
      {
        conversationId,

        userId,

        role: "MEMBER",

        joinedAt: now,

        leftAt: null,
      },
      {
        transaction:
          options.transaction,
      }
    );

  return {
    created: true,

    membership,
  };
}

async function deactivateMembership(
  membership,
  options = {}
) {
  membership.leftAt =
    new Date();

  return membership.save({
    transaction:
      options.transaction,
  });
}

async function updateMembershipRole(
  membership,
  role,
  options = {}
) {
  membership.role =
    role;

  return membership.save({
    transaction:
      options.transaction,
  });
}

async function updateGroupTitle(
  conversation,
  title,
  options = {}
) {
  conversation.title =
    title;

  return conversation.save({
    transaction:
      options.transaction,
  });
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  findDirectByKey,

  createDirectConversation,

  addMembers,

  findMembership,

  findMembershipIncludingLeft,

  findActiveMembers,

  countActiveMembers,

  updateReadCursor,

  findRelatedUserIds,

  createGroupConversation,

  addGroupMembers,

  findConversationById,

  addOrReactivateMember,

  deactivateMembership,

  updateMembershipRole,

  updateGroupTitle,
};