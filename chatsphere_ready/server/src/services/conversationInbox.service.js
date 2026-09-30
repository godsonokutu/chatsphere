"use strict";

const {
  QueryTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

// ======================================================
// CURSOR
// ======================================================

function encodeCursor({
  sortAt,
  id,
}) {
  return Buffer
    .from(
      JSON.stringify({
        v: 1,
        sortAt,
        id:
          String(id),
      }),
      "utf8"
    )
    .toString(
      "base64url"
    );
}

function decodeCursor(
  cursor
) {
  if (!cursor) {
    return null;
  }

  if (
    typeof cursor !==
      "string" ||
    cursor.length > 512
  ) {
    throw new Error(
      "Invalid conversation cursor."
    );
  }

  try {
    const decoded =
      JSON.parse(
        Buffer
          .from(
            cursor,
            "base64url"
          )
          .toString(
            "utf8"
          )
      );

    if (
      decoded?.v !== 1 ||
      !decoded?.sortAt ||
      !decoded?.id
    ) {
      throw new Error();
    }

    return {
      sortAt:
        decoded.sortAt,

      id:
        String(
          decoded.id
        ),
    };
  } catch {
    throw new Error(
      "Invalid conversation cursor."
    );
  }
}

// ======================================================
// LIMIT
// ======================================================

function normalizeLimit(
  value
) {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(
      parsed
    )
  ) {
    return 30;
  }

  return Math.min(
    Math.max(
      parsed,
      1
    ),
    100
  );
}

// ======================================================
// LIST CONVERSATIONS
// ======================================================

async function listConversations({
  userId,
  cursor,
  limit,
}) {
  const normalizedUserId =
    String(userId);

  const normalizedLimit =
    normalizeLimit(
      limit
    );

  const decodedCursor =
    decodeCursor(
      cursor
    );

  const fetchLimit =
    normalizedLimit + 1;

  const replacements = {
    userId:
      normalizedUserId,

    fetchLimit,
  };

  let cursorCondition =
    "";

  if (
    decodedCursor
  ) {
    replacements.cursorSortAt =
      decodedCursor.sortAt;

    replacements.cursorId =
      decodedCursor.id;

    cursorCondition = `
      AND (
        COALESCE(
          c.last_message_at,
          c.created_at
        ) < :cursorSortAt

        OR (

          COALESCE(
            c.last_message_at,
            c.created_at
          ) = :cursorSortAt

          AND c.id <
            :cursorId
        )
      )
    `;
  }

  const rows =
    await sequelize.query(
      `
      SELECT

        c.id AS conversationId,

        c.type AS conversationType,

        c.title AS conversationTitle,

        c.created_at AS conversationCreatedAt,

        COALESCE(
          c.last_message_at,
          c.created_at
        ) AS sortAt,

        cm.role AS currentUserRole,

        -- ==========================================
        -- DIRECT PARTICIPANT
        -- ==========================================

        direct_user.id
          AS participantId,

        direct_user.username
          AS participantUsername,

        direct_user.last_seen_at
          AS participantLastSeenAt,

        -- ==========================================
        -- GROUP MEMBER COUNT
        -- ==========================================

        (
          SELECT
            COUNT(*)

          FROM
            conversation_members
              group_member

          WHERE
            group_member.conversation_id =
              c.id

            AND group_member.left_at
              IS NULL
        ) AS memberCount,

        -- ==========================================
        -- LAST MESSAGE
        -- ==========================================

        last_message.id
          AS lastMessageId,

        last_message.sender_id
          AS lastMessageSenderId,

        last_message.type
          AS lastMessageType,

        last_message.content
          AS lastMessageContent,

        last_message.deleted_at
          AS lastMessageDeletedAt,

        last_message.created_at
          AS lastMessageCreatedAt,

        -- ==========================================
        -- UNREAD COUNT
        -- ==========================================

        (
          SELECT
            COUNT(*)

          FROM
            messages unread_message

          WHERE
            unread_message.conversation_id =
              c.id

            AND unread_message.sender_id
              <> :userId

            AND unread_message.created_at
              >= cm.joined_at

            AND (
              cm.last_read_message_id
                IS NULL

              OR unread_message.id
                > cm.last_read_message_id
            )
        ) AS unreadCount

      FROM
        conversation_members cm

      INNER JOIN
        conversations c

        ON c.id =
          cm.conversation_id

      -- ============================================
      -- OTHER MEMBER OF DIRECT CHAT
      -- ============================================

      LEFT JOIN
        conversation_members direct_member

        ON direct_member.conversation_id =
          c.id

        AND direct_member.user_id
          <> :userId

        AND direct_member.left_at
          IS NULL

        AND c.type =
          'DIRECT'

      LEFT JOIN
        users direct_user

        ON direct_user.id =
          direct_member.user_id

        AND direct_user.deleted_at
          IS NULL

      -- ============================================
      -- MOST RECENT MESSAGE
      -- ============================================

      LEFT JOIN
        messages last_message

        ON last_message.id =
          (

            SELECT
              latest.id

            FROM
              messages latest

            WHERE
              latest.conversation_id =
                c.id

              AND latest.created_at
                >= cm.joined_at

            ORDER BY
              latest.id DESC

            LIMIT 1
          )

      WHERE

        cm.user_id =
          :userId

        AND cm.left_at
          IS NULL

        ${cursorCondition}

      ORDER BY

        COALESCE(
          c.last_message_at,
          c.created_at
        ) DESC,

        c.id DESC

      LIMIT :fetchLimit
      `,
      {
        replacements,

        type:
          QueryTypes.SELECT,
      }
    );

  const hasMore =
    rows.length >
    normalizedLimit;

  const page =
    hasMore
      ? rows.slice(
          0,
          normalizedLimit
        )
      : rows;

  const conversations =
    page.map(
      (row) => {
        const conversation = {
          id:
            String(
              row.conversationId
            ),

          type:
            row.conversationType,

          title:
            row.conversationType ===
              "GROUP"
              ? row.conversationTitle
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
        };

        if (
          row.conversationType ===
          "DIRECT"
        ) {
          conversation.participant = {
            id:
              row.participantId
                ? String(
                    row.participantId
                  )
                : null,

            username:
              row.participantUsername ||
              "Unavailable user",

            lastSeenAt:
              row.participantLastSeenAt ||
              null,
          };
        }

        if (
          row.conversationType ===
          "GROUP"
        ) {
          conversation.memberCount =
            Number(
              row.memberCount ||
              0
            );

          conversation.currentUserRole =
            row.currentUserRole;
        }

        return conversation;
      }
    );

  const lastRow =
    page[
      page.length - 1
    ];

  const nextCursor =
    hasMore &&
    lastRow
      ? encodeCursor({
          sortAt:
            lastRow.sortAt,

          id:
            lastRow.conversationId,
        })
      : null;

  return {
    conversations,

    pagination: {
      hasMore,

      nextCursor,

      limit:
        normalizedLimit,
    },
  };
}

module.exports = {
  listConversations,
};