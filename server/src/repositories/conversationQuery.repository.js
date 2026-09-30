"use strict";

const {
  QueryTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

async function listForUser({
  userId,
  limit,
  cursor,
}) {
  const cursorCondition =
    cursor
      ? `
        WHERE (
          base.sortAt < :cursorSortAt
          OR (
            base.sortAt = :cursorSortAt
            AND base.id < :cursorId
          )
        )
        `
      : "";

  const sql = `
    SELECT
      base.id,
      base.type,
      base.title,
      base.createdBy,
      base.currentUserRole,
      base.joinedAt,
      base.lastReadMessageId,
      base.sortAt,
      base.unreadCount,

      lm.id AS lastMessageId,
      lm.sender_id AS lastMessageSenderId,
      lm.type AS lastMessageType,

      CASE
        WHEN lm.deleted_at IS NULL
        THEN lm.content
        ELSE NULL
      END AS lastMessageContent,

      lm.deleted_at AS lastMessageDeletedAt,
      lm.created_at AS lastMessageCreatedAt,

      other_cm.user_id AS participantId,

      CASE
        WHEN other_u.deleted_at IS NULL
        THEN other_u.username
        ELSE NULL
      END AS participantUsername,

      CASE
        WHEN other_u.deleted_at IS NULL
        THEN other_u.last_seen_at
        ELSE NULL
      END AS participantLastSeenAt,

      CASE
        WHEN base.type = 'GROUP'
        THEN (
          SELECT COUNT(*)
          FROM conversation_members group_cm
          WHERE
            group_cm.conversation_id = base.id
            AND group_cm.left_at IS NULL
        )
        ELSE NULL
      END AS memberCount

    FROM (
      SELECT
        c.id,
        c.type,
        c.title,

        c.created_by AS createdBy,

        cm.role AS currentUserRole,

        cm.joined_at AS joinedAt,

        cm.last_read_message_id
          AS lastReadMessageId,

        COALESCE(
          MAX(m.created_at),
          cm.joined_at
        ) AS sortAt,

        MAX(m.id)
          AS lastMessageId,

        SUM(
          CASE
            WHEN
              m.id IS NOT NULL
              AND m.sender_id <> :userId
              AND m.deleted_at IS NULL
              AND (
                cm.last_read_message_id IS NULL
                OR
                m.id > cm.last_read_message_id
              )
            THEN 1
            ELSE 0
          END
        ) AS unreadCount

      FROM conversation_members cm

      INNER JOIN conversations c
        ON c.id = cm.conversation_id

      LEFT JOIN messages m
        ON m.conversation_id = c.id
        AND m.created_at >= cm.joined_at

      WHERE
        cm.user_id = :userId
        AND cm.left_at IS NULL

      GROUP BY
        c.id,
        c.type,
        c.title,
        c.created_by,
        cm.role,
        cm.joined_at,
        cm.last_read_message_id
    ) base

    LEFT JOIN messages lm
      ON lm.id = base.lastMessageId

    LEFT JOIN conversation_members other_cm
      ON base.type = 'DIRECT'
      AND other_cm.conversation_id = base.id
      AND other_cm.user_id <> :userId
      AND other_cm.left_at IS NULL

    LEFT JOIN users other_u
      ON other_u.id = other_cm.user_id

    ${cursorCondition}

    ORDER BY
      base.sortAt DESC,
      base.id DESC

    LIMIT :fetchLimit
  `;

  return sequelize.query(
    sql,
    {
      replacements: {
        userId,

        fetchLimit:
          limit + 1,

        ...(cursor
          ? {
              cursorSortAt:
                cursor.sortAt,

              cursorId:
                cursor.id,
            }
          : {}),
      },

      type:
        QueryTypes.SELECT,
    }
  );
}

module.exports = {
  listForUser,
};