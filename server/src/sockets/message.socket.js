"use strict";

const messageService =
  require("../services/message.service");

const {
  assertSocketSessionActive,
} =
  require("./authenticateSocket");

const {
  userRoom,
} =
  require("./rooms");

const logger =
  require("../config/logger");

// ======================================================
// SOCKET EVENT RATE LIMITING
//
// Process-local limiter.
//
// Keys are based on authenticated user ID rather than
// socket ID so opening multiple tabs does not give a
// user a fresh quota.
//
// Redis will replace this store when ChatSphere runs
// across multiple Node instances.
// ======================================================

const SOCKET_RATE_LIMITS =
  Object.freeze({
    "message:send": {
      limit: 30,
      windowMs:
        10 * 1000,
    },

    "message:delivered": {
      limit: 120,
      windowMs:
        10 * 1000,
    },

    "conversation:read": {
      limit: 60,
      windowMs:
        10 * 1000,
    },
  });

const socketRateLimitBuckets =
  new Map();

function enforceSocketRateLimit(
  socket,
  eventName
) {
  const config =
    SOCKET_RATE_LIMITS[
      eventName
    ];

  if (!config) {
    return;
  }

  const userId =
    socket.data?.auth
      ?.userId;

  if (!userId) {
    const error =
      new Error(
        "Authentication required."
      );

    error.code =
      "AUTHENTICATION_REQUIRED";

    error.publicMessage =
      "Authentication required.";

    throw error;
  }

  const key =
    `${String(userId)}:${eventName}`;

  const now =
    Date.now();

  const existing =
    socketRateLimitBuckets
      .get(key);

  /*
   * Start a new fixed window when:
   *
   * - this is the first request, or
   * - the previous window expired.
   */
  if (
    !existing ||
    now >=
      existing.resetAt
  ) {
    socketRateLimitBuckets
      .set(
        key,
        {
          count: 1,

          resetAt:
            now +
            config.windowMs,
        }
      );

    return;
  }

  if (
    existing.count >=
    config.limit
  ) {
    const retryAfterMs =
      Math.max(
        0,
        existing.resetAt -
          now
      );

    const error =
      new Error(
        "Too many realtime requests."
      );

    error.code =
      "SOCKET_RATE_LIMITED";

    error.publicMessage =
      "Too many realtime requests. Please try again shortly.";

    /*
     * Internal information only.
     * publicSocketError() will not expose it.
     */
    error.retryAfterMs =
      retryAfterMs;

    throw error;
  }

  existing.count += 1;
}

/*
 * Prevent stale rate-limit entries from remaining in
 * process memory indefinitely.
 */
const rateLimitCleanupTimer =
  setInterval(
    () => {
      const now =
        Date.now();

      for (
        const [
          key,
          bucket,
        ]
        of socketRateLimitBuckets
      ) {
        if (
          now >=
          bucket.resetAt
        ) {
          socketRateLimitBuckets
            .delete(key);
        }
      }
    },
    60 * 1000
  );

/*
 * This maintenance timer must not keep the Node process
 * alive during graceful shutdown.
 */
rateLimitCleanupTimer.unref?.();

// ======================================================
// ACK HELPER
// ======================================================

function acknowledge(
  callback,
  payload
) {
  if (
    typeof callback ===
    "function"
  ) {
    callback(
      payload
    );
  }
}

// ======================================================
// SAFE PUBLIC SOCKET ERROR
// ======================================================

function publicSocketError(
  error
) {
  return {
    success:
      false,

    error: {
      code:
        error?.code ||
        "INTERNAL_SERVER_ERROR",

      message:
        error?.publicMessage ||
        "Unable to process request.",
    },
  };
}

// ======================================================
// REGISTER MESSAGE HANDLERS
// ======================================================

function registerMessageHandlers(
  io,
  socket
) {
  // ====================================================
  // SEND MESSAGE
  // ====================================================

  socket.on(
    "message:send",
    async (
      payload,
      callback
    ) => {
      try {
        enforceSocketRateLimit(
          socket,
          "message:send"
        );

        await assertSocketSessionActive(
          socket
        );

        const result =
          await messageService
            .sendMessage({
              conversationId:
                payload
                  ?.conversationId,

              senderId:
                socket.data
                  .auth
                  .userId,

              clientMessageId:
                payload
                  ?.clientMessageId,

              content:
                payload
                  ?.content,
            });

        /*
         * Only newly-created messages are
         * broadcast.
         *
         * Idempotent retries receive the existing
         * message through acknowledgement.
         */
        if (
          result.created
        ) {
          // ------------------------------------------
          // Recipients
          // ------------------------------------------

          for (
            const recipientId
            of result
              .recipientIds
          ) {
            io.to(
              userRoom(
                recipientId
              )
            ).emit(
              "message:new",
              result.message
            );
          }

          // ------------------------------------------
          // Sender's other devices
          // ------------------------------------------

          socket
            .to(
              userRoom(
                socket.data
                  .auth
                  .userId
              )
            )
            .emit(
              "message:new",
              result.message
            );
        }

        acknowledge(
          callback,
          {
            success:
              true,

            created:
              result.created,

            message:
              result.message,
          }
        );
      } catch (
        error
      ) {
        logger.error(
          {
            err:
              error,

            socketId:
              socket.id,

            userId:
              socket.data
                ?.auth
                ?.userId,
          },
          "Socket message send failed"
        );

        acknowledge(
          callback,
          publicSocketError(
            error
          )
        );
      }
    }
  );

  // ====================================================
  // DELIVERY ACKNOWLEDGEMENT
  // ====================================================

  socket.on(
    "message:delivered",
    async (
      payload,
      callback
    ) => {
      try {
        enforceSocketRateLimit(
          socket,
          "message:delivered"
        );

        await assertSocketSessionActive(
          socket
        );

        const result =
          await messageService
            .markDelivered({
              messageId:
                payload
                  ?.messageId,

              userId:
                socket.data
                  .auth
                  .userId,
            });

        /*
         * IMPORTANT:
         *
         * We publish the authoritative delivery
         * state even when changed === false.
         *
         * Example:
         * Recipient already acknowledged delivery,
         * but sender reconnected and missed the
         * original event.
         *
         * A duplicate delivery acknowledgement
         * now repairs sender state.
         */
        if (
          result.senderId &&
          result.deliveredAt
        ) {
          io.to(
            userRoom(
              result.senderId
            )
          ).emit(
            "message:delivery",
            {
              messageId:
                result.messageId,

              userId:
                result
                  .recipientId,

              deliveredAt:
                result
                  .deliveredAt,
            }
          );
        }

        acknowledge(
          callback,
          {
            success:
              true,

            messageId:
              result.messageId,

            deliveredAt:
              result.deliveredAt,
          }
        );
      } catch (
        error
      ) {
        logger.error(
          {
            err:
              error,

            socketId:
              socket.id,

            userId:
              socket.data
                ?.auth
                ?.userId,
          },
          "Socket delivery acknowledgement failed"
        );

        acknowledge(
          callback,
          publicSocketError(
            error
          )
        );
      }
    }
  );

  // ====================================================
  // READ ACKNOWLEDGEMENT
  // ====================================================

  socket.on(
    "conversation:read",
    async (
      payload,
      callback
    ) => {
      try {
        enforceSocketRateLimit(
          socket,
          "conversation:read"
        );

        await assertSocketSessionActive(
          socket
        );

        const result =
          await messageService
            .markConversationRead({
              conversationId:
                payload
                  ?.conversationId,

              messageId:
                payload
                  ?.messageId,

              userId:
                socket.data
                  .auth
                  .userId,
            });

        /*
         * IMPORTANT:
         *
         * Broadcast the authoritative cursor even
         * when changed === false.
         *
         * Read events are idempotent state
         * synchronization, not one-time
         * notifications.
         */
        for (
          const recipientId
          of result
            .recipientIds
        ) {
          io.to(
            userRoom(
              recipientId
            )
          ).emit(
            "conversation:read",
            {
              conversationId:
                result
                  .conversationId,

              userId:
                result.userId,

              lastReadMessageId:
                result
                  .lastReadMessageId,

              readAt:
                result
                  .lastReadAt,
            }
          );
        }

        acknowledge(
          callback,
          {
            success:
              true,

            conversationId:
              result
                .conversationId,

            lastReadMessageId:
              result
                .lastReadMessageId,

            readAt:
              result
                .lastReadAt,
          }
        );
      } catch (
        error
      ) {
        logger.error(
          {
            err:
              error,

            socketId:
              socket.id,

            userId:
              socket.data
                ?.auth
                ?.userId,
          },
          "Socket read acknowledgement failed"
        );

        acknowledge(
          callback,
          publicSocketError(
            error
          )
        );
      }
    }
  );
}

module.exports = {
  registerMessageHandlers,
};