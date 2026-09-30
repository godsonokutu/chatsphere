"use strict";

const {
  QueryTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

// ======================================================
// DIRECT MESSAGE DELIVERY / READ STATE
//
// For direct conversations:
//
// SENT
//   Message exists in DB.
//
// DELIVERED
//   Recipient's receipt has delivered_at.
//
// READ
//   Recipient's conversation read cursor has moved
//   to this message or beyond.
//
// This allows receipt state to survive browser refresh.
// ======================================================

async function findDirectMessageStatuses({
  conversationId,
  senderId,
  messageIds,
}) {
  if (
    !Array.isArray(
      messageIds
    ) ||
    messageIds.length === 0
  ) {
    return [];
  }

  const rows =
    await sequelize.query(
      `
      SELECT
        m.id AS messageId,

        CASE
          WHEN
            recipient_cm.last_read_message_id IS NOT NULL
            AND recipient_cm.last_read_message_id >= m.id
          THEN 'READ'

          WHEN
            mr.delivered_at IS NOT NULL
          THEN 'DELIVERED'

          ELSE 'SENT'
        END AS deliveryStatus

      FROM messages m

      INNER JOIN conversations c
        ON c.id = m.conversation_id
        AND c.type = 'DIRECT'

      INNER JOIN conversation_members recipient_cm
        ON recipient_cm.conversation_id = m.conversation_id
        AND recipient_cm.user_id <> :senderId
        AND recipient_cm.left_at IS NULL

      LEFT JOIN message_receipts mr
        ON mr.message_id = m.id
        AND mr.user_id = recipient_cm.user_id

      WHERE
        m.conversation_id = :conversationId

        AND m.sender_id = :senderId

        AND m.id IN (:messageIds)
      `,
      {
        replacements: {
          conversationId,

          senderId,

          messageIds,
        },

        type:
          QueryTypes.SELECT,
      }
    );

  return rows.map(
    (row) => ({
      messageId:
        String(
          row.messageId
        ),

      deliveryStatus:
        row.deliveryStatus,
    })
  );
}

module.exports = {
  findDirectMessageStatuses,
};