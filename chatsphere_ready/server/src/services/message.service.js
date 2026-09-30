"use strict";

const {
  UniqueConstraintError,
} = require("sequelize");

const sequelize =
  require("../config/db");

const conversationRepository =
  require("../repositories/conversation.repository");

const messageRepository =
  require("../repositories/message.repository");

const userRepository =
  require("../repositories/user.repository");

const messageValidator =
  require("../validators/message.validator");

const AppError =
  require("../errors/AppError");

const errorCodes =
  require("../errors/errorCodes");

// ======================================================
// SERIALIZE MESSAGE
// ======================================================

function serializeMessage(
  message,
  senderUsername = null
) {
  return {
    id:
      String(
        message.id
      ),

    conversationId:
      String(
        message.conversationId
      ),

    senderId:
      message.senderId
        ? String(
            message.senderId
          )
        : null,

    /*
     * Important for GROUP chats.
     *
     * Direct chats already know the other
     * participant from the conversation DTO,
     * but group chats need to identify which
     * member sent each message.
     */
    senderUsername:
      senderUsername ||
      null,

    clientMessageId:
      message.clientMessageId,

    type:
      message.type,

    content:
      message.deletedAt
        ? null
        : message.content,

    editedAt:
      message.editedAt,

    deletedAt:
      message.deletedAt,

    createdAt:
      message.createdAt,
  };
}

// ======================================================
// ASSERT ACTIVE MEMBERSHIP
// ======================================================

async function assertMembership(
  conversationId,
  userId,
  options = {}
) {
  const membership =
    await conversationRepository
      .findMembership(
        conversationId,
        userId,
        options
      );

  if (!membership) {
    /*
     * Deliberately generic.
     *
     * Do not reveal whether a private
     * conversation actually exists to
     * someone who is not an active member.
     */
    throw new AppError({
      code:
        errorCodes.CONVERSATION
          .CONVERSATION_NOT_FOUND,

      statusCode:
        404,

      publicMessage:
        "Conversation not found or unavailable.",

      internalMessage:
        `User ${userId} attempted to access unavailable conversation ${conversationId}.`,
    });
  }

  return membership;
}

// ======================================================
// SEND MESSAGE
// ======================================================

async function sendMessage({
  conversationId,
  senderId,
  clientMessageId,
  content,
}) {
  const validConversationId =
    messageValidator
      .validateConversationId(
        conversationId
      );

  const input =
    messageValidator
      .validateSendMessage({
        clientMessageId,
        content,
      });

  /*
   * Authorization check before doing any
   * message-related database work.
   */
  await assertMembership(
    validConversationId,
    senderId
  );

  /*
   * Load the sender once.
   *
   * This username is attached to the
   * realtime message DTO so group-chat
   * recipients immediately know who sent it.
   */
  const sender =
    await userRepository
      .findConversationParticipantById(
        senderId
      );

  const senderUsername =
    sender?.username ||
    null;

  /*
   * Fast idempotency check before opening
   * the transaction.
   */
  const existing =
    await messageRepository
      .findBySenderAndClientId(
        senderId,
        input.clientMessageId
      );

  if (existing) {
    if (
      String(
        existing.conversationId
      ) !==
        String(
          validConversationId
        ) ||
      existing.content !==
        input.content
    ) {
      throw new AppError({
        code:
          errorCodes.MESSAGE
            .IDEMPOTENCY_CONFLICT,

        statusCode:
          409,

        publicMessage:
          "This message identifier has already been used.",

        internalMessage:
          `Client message ID ${input.clientMessageId} was reused with different message data.`,
      });
    }

    return {
      created:
        false,

      message:
        serializeMessage(
          existing,
          senderUsername
        ),

      recipientIds:
        [],
    };
  }

  try {
    const result =
      await sequelize.transaction(
        async (
          transaction
        ) => {
          /*
           * Recheck membership inside the
           * transaction.
           *
           * This protects against membership
           * changing between the first check
           * and message creation.
           */
          await assertMembership(
            validConversationId,
            senderId,
            {
              transaction,
            }
          );

          const message =
            await messageRepository
              .createMessage(
                {
                  conversationId:
                    validConversationId,

                  senderId,

                  clientMessageId:
                    input.clientMessageId,

                  type:
                    "TEXT",

                  content:
                    input.content,

                  editedAt:
                    null,

                  deletedAt:
                    null,
                },
                {
                  transaction,
                }
              );

          /*
           * Create one receipt for every
           * current recipient except sender.
           */
          const members =
            await conversationRepository
              .findActiveMembers(
                validConversationId,
                {
                  transaction,
                }
              );

          const recipientIds =
            members
              .map(
                (
                  member
                ) =>
                  String(
                    member.userId
                  )
              )
              .filter(
                (
                  userId
                ) =>
                  userId !==
                  String(
                    senderId
                  )
              );

          await messageRepository
            .createReceipts(
              message.id,
              recipientIds,
              {
                transaction,
              }
            );

          /*
           * Keep conversation ordering
           * synchronized with the newest
           * successfully committed message.
           */
          await messageRepository
            .updateConversationLastMessage(
              validConversationId,
              message.createdAt,
              {
                transaction,
              }
            );

          return {
            message,
            recipientIds,
          };
        }
      );

    return {
      created:
        true,

      message:
        serializeMessage(
          result.message,
          senderUsername
        ),

      recipientIds:
        result.recipientIds,
    };
  } catch (
    error
  ) {
    /*
     * Two retries may arrive concurrently.
     *
     * The unique database index is the final
     * idempotency protection.
     */
    if (
      error instanceof
      UniqueConstraintError
    ) {
      const duplicate =
        await messageRepository
          .findBySenderAndClientId(
            senderId,
            input.clientMessageId
          );

      if (!duplicate) {
        throw error;
      }

      if (
        String(
          duplicate.conversationId
        ) !==
          String(
            validConversationId
          ) ||
        duplicate.content !==
          input.content
      ) {
        throw new AppError({
          code:
            errorCodes.MESSAGE
              .IDEMPOTENCY_CONFLICT,

          statusCode:
            409,

          publicMessage:
            "This message identifier has already been used.",

          internalMessage:
            `Concurrent idempotency conflict for ${input.clientMessageId}.`,
        });
      }

      return {
        created:
          false,

        message:
          serializeMessage(
            duplicate,
            senderUsername
          ),

        recipientIds:
          [],
      };
    }

    throw error;
  }
}

// ======================================================
// GET MESSAGE HISTORY
// ======================================================

async function getMessages({
  conversationId,
  userId,
  before,
  limit,
}) {
  const validConversationId =
    messageValidator
      .validateConversationId(
        conversationId
      );

  const pagination =
    messageValidator
      .validatePagination({
        before,
        limit,
      });

  /*
   * Membership also gives us joinedAt.
   *
   * A member who leaves and later rejoins
   * must not automatically regain access
   * to message history from before the
   * latest join.
   */
  const membership =
    await assertMembership(
      validConversationId,
      userId
    );

  const rows =
    await messageRepository
      .listMessages({
        conversationId:
          validConversationId,

        beforeId:
          pagination.before,

        limit:
          pagination.limit,

        joinedAt:
          membership.joinedAt,
      });

  const hasMore =
    rows.length >
    pagination.limit;

  const page =
    hasMore
      ? rows.slice(
          0,
          pagination.limit
        )
      : rows;

  const nextCursor =
    hasMore &&
    page.length > 0
      ? String(
          page[
            page.length - 1
          ].id
        )
      : null;

  // ====================================================
  // LOAD SENDERS IN ONE QUERY
  // ====================================================

  /*
   * Do NOT query the users table once for
   * every message.
   *
   * Collect unique sender IDs and fetch them
   * together. This avoids the N+1 query
   * problem when loading group history.
   */
  const senderIds =
    [
      ...new Set(
        page
          .filter(
            (
              message
            ) =>
              Boolean(
                message.senderId
              )
          )
          .map(
            (
              message
            ) =>
              String(
                message.senderId
              )
          )
      ),
    ];

  const senders =
    senderIds.length >
    0
      ? await userRepository
          .findConversationParticipantsByIds(
            senderIds
          )
      : [];

  const usernameByUserId =
    new Map(
      senders.map(
        (
          sender
        ) => [
          String(
            sender.id
          ),

          sender.username,
        ]
      )
    );

  /*
   * Database query is newest-first for
   * efficient keyset pagination.
   *
   * API response is oldest-first for normal
   * chat rendering.
   */
  const messages =
    page
      .map(
        (
          message
        ) =>
          serializeMessage(
            message,

            message.senderId
              ? usernameByUserId.get(
                  String(
                    message.senderId
                  )
                ) ||
                null
              : null
          )
      )
      .reverse();

  return {
    messages,

    pagination: {
      hasMore,

      nextCursor,

      limit:
        pagination.limit,
    },
  };
}

// ======================================================
// MARK MESSAGE DELIVERED
// ======================================================

async function markDelivered({
  messageId,
  userId,
}) {
  const validMessageId =
    messageValidator
      .validateMessageId(
        messageId
      );

  const receipt =
    await messageRepository
      .findReceipt(
        validMessageId,
        userId
      );

  if (!receipt) {
    throw new AppError({
      code:
        errorCodes.MESSAGE
          .MESSAGE_UNAVAILABLE,

      statusCode:
        404,

      publicMessage:
        "Message not found or unavailable.",

      internalMessage:
        `User ${userId} attempted to acknowledge unavailable message ${validMessageId}.`,
    });
  }

  /*
   * Already delivered.
   *
   * Return existing state instead of
   * creating another state transition.
   */
  if (
    receipt.deliveredAt
  ) {
    const message =
      await messageRepository
        .findMessageById(
          validMessageId
        );

    return {
      changed:
        false,

      messageId:
        String(
          validMessageId
        ),

      recipientId:
        String(
          userId
        ),

      senderId:
        message?.senderId
          ? String(
              message.senderId
            )
          : null,

      deliveredAt:
        receipt.deliveredAt,
    };
  }

  const deliveredAt =
    new Date();

  const [
    updatedCount,
  ] =
    await messageRepository
      .markDelivered(
        validMessageId,
        userId,
        deliveredAt
      );

  /*
   * Another browser/device belonging to the
   * same account may acknowledge the same
   * message concurrently.
   */
  const updatedReceipt =
    await messageRepository
      .findReceipt(
        validMessageId,
        userId
      );

  const message =
    await messageRepository
      .findMessageById(
        validMessageId
      );

  if (!message) {
    throw new AppError({
      code:
        errorCodes.MESSAGE
          .MESSAGE_UNAVAILABLE,

      statusCode:
        404,

      publicMessage:
        "Message not found or unavailable.",

      internalMessage:
        `Receipt exists but message ${validMessageId} could not be loaded.`,
    });
  }

  return {
    changed:
      updatedCount >
      0,

    messageId:
      String(
        message.id
      ),

    recipientId:
      String(
        userId
      ),

    senderId:
      message.senderId
        ? String(
            message.senderId
          )
        : null,

    deliveredAt:
      updatedReceipt
        ?.deliveredAt ||
      deliveredAt,
  };
}

// ======================================================
// MARK CONVERSATION READ
// ======================================================

async function markConversationRead({
  conversationId,
  userId,
  messageId,
}) {
  const validConversationId =
    messageValidator
      .validateConversationId(
        conversationId
      );

  const validMessageId =
    messageValidator
      .validateMessageId(
        messageId
      );

  const result =
    await sequelize.transaction(
      async (
        transaction
      ) => {
        const membership =
          await conversationRepository
            .findMembership(
              validConversationId,
              userId,
              {
                transaction,
                lock: true,
              }
            );

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
              `User ${userId} attempted read acknowledgement for unavailable conversation ${validConversationId}.`,
          });
        }

        const message =
          await messageRepository
            .findInConversation(
              validMessageId,
              validConversationId,
              {
                transaction,
              }
            );

        if (!message) {
          throw new AppError({
            code:
              errorCodes.MESSAGE
                .MESSAGE_UNAVAILABLE,

            statusCode:
              404,

            publicMessage:
              "Message not found or unavailable.",

            internalMessage:
              `Message ${validMessageId} was not found in conversation ${validConversationId}.`,
          });
        }

        /*
         * The user's read cursor may only
         * move forward.
         */
        if (
          membership
            .lastReadMessageId &&
          BigInt(
            String(
              validMessageId
            )
          ) <=
            BigInt(
              String(
                membership
                  .lastReadMessageId
              )
            )
        ) {
          return {
            changed:
              false,

            conversationId:
              String(
                validConversationId
              ),

            userId:
              String(
                userId
              ),

            lastReadMessageId:
              String(
                membership
                  .lastReadMessageId
              ),

            lastReadAt:
              membership
                .lastReadAt,

            recipientIds:
              [],
          };
        }

        const now =
          new Date();

        await conversationRepository
          .updateReadCursor(
            membership,
            {
              lastReadMessageId:
                validMessageId,

              lastReadAt:
                now,
            },
            {
              transaction,
            }
          );

        /*
         * Inform every other active member
         * that this user's read cursor moved.
         */
        const members =
          await conversationRepository
            .findActiveMembers(
              validConversationId,
              {
                transaction,
              }
            );

        const recipientIds =
          members
            .map(
              (
                member
              ) =>
                String(
                  member.userId
                )
            )
            .filter(
              (
                memberUserId
              ) =>
                memberUserId !==
                String(
                  userId
                )
            );

        return {
          changed:
            true,

          conversationId:
            String(
              validConversationId
            ),

          userId:
            String(
              userId
            ),

          lastReadMessageId:
            String(
              validMessageId
            ),

          lastReadAt:
            now,

          recipientIds,
        };
      }
    );

  return result;
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  sendMessage,
  getMessages,
  markDelivered,
  markConversationRead,
};