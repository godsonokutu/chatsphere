"use strict";

const {
  Server,
} = require("socket.io");

const presenceStore =
  require("./presence.store");

const presenceService =
  require("../services/presence.service");

const conversationRepository =
  require("../repositories/conversation.repository");

const {
  userRoom,
} = require("./rooms");

const {
  registerMessageHandlers,
} = require("./message.socket");

const socketConfig =
  require("../config/socket.config");

const {
  authenticateSocket,
  scheduleTokenExpiry,
} = require("./authenticateSocket");

const logger =
  require("../config/logger");

// ======================================================
// ACKNOWLEDGEMENT HELPER
// ======================================================

function acknowledge(
  callback,
  payload
) {
  if (
    typeof callback ===
    "function"
  ) {
    callback(payload);
  }
}

// ======================================================
// BUILD PRESENCE SNAPSHOT
//
// Realtime presence events only describe changes.
//
// When a client connects, it also needs to know which
// existing direct/group contacts are already online.
// ======================================================

async function buildPresenceSnapshot(
  userId
) {
  const relatedUserIds =
    await conversationRepository
      .findRelatedUserIds(
        userId
      );

  const onlineUserIds =
    relatedUserIds
      .filter(
        (
          relatedUserId
        ) =>
          presenceStore
            .isOnline(
              relatedUserId
            )
      )
      .map(String);

  return {
    onlineUserIds,
  };
}

// ======================================================
// SOCKET INITIALIZATION
// ======================================================

function initializeSocket(
  httpServer
) {
  const io =
    new Server(
      httpServer,
      {
        /*
         * socketConfig itself can remain frozen.
         *
         * Socket.io receives mutable copies.
         */
        ...socketConfig,

        cors: {
          ...socketConfig.cors,
        },
      }
    );

  // ====================================================
  // SOCKET AUTHENTICATION
  // ====================================================

  io.use(
    authenticateSocket
  );

  // ====================================================
  // CONNECTION
  // ====================================================

  io.on(
    "connection",
    (socket) => {
      const userId =
        String(
          socket.data.auth
            .userId
        );

      // ------------------------------------------------
      // Join user's logical room first
      // ------------------------------------------------

      socket.join(
        userRoom(
          userId
        )
      );

      // ------------------------------------------------
      // Track this connection
      // ------------------------------------------------

      const presenceResult =
        presenceStore
          .addConnection(
            userId
          );

      /*
       * Multiple browser tabs/devices must not
       * repeatedly publish ONLINE.
       *
       * Only the transition:
       *
       * 0 connections -> 1 connection
       *
       * becomes ONLINE.
       */
      if (
        presenceResult
          .becameOnline
      ) {
        presenceService
          .publishOnline(
            io,
            userId
          )
          .catch(
            (error) => {
              logger.error(
                {
                  err:
                    error,

                  userId,
                },
                "Failed to publish online presence"
              );
            }
          );
      }

      // ------------------------------------------------
      // Presence synchronization
      //
      // Client explicitly requests this after every
      // successful connection/reconnection.
      // ------------------------------------------------

      socket.on(
        "presence:sync",
        async (
          callback
        ) => {
          try {
            const snapshot =
              await buildPresenceSnapshot(
                userId
              );

            acknowledge(
              callback,
              {
                success:
                  true,

                ...snapshot,
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

                userId,
              },
              "Failed to build presence snapshot"
            );

            acknowledge(
              callback,
              {
                success:
                  false,

                error: {
                  code:
                    "PRESENCE_SYNC_FAILED",

                  message:
                    "Unable to synchronize presence.",
                },
              }
            );
          }
        }
      );

      // ------------------------------------------------
      // Enforce access-token expiry
      // ------------------------------------------------

      scheduleTokenExpiry(
        socket
      );

      // ------------------------------------------------
      // Messaging / receipts
      // ------------------------------------------------

      registerMessageHandlers(
        io,
        socket
      );

      logger.info(
        {
          socketId:
            socket.id,

          userId,

          sessionId:
            socket.data.auth
              .sessionId,
        },
        "Socket connected"
      );

      // ==================================================
      // DISCONNECT
      // ==================================================

      socket.on(
        "disconnect",
        (reason) => {
          const result =
            presenceStore
              .removeConnection(
                userId
              );

          logger.info(
            {
              socketId:
                socket.id,

              userId,

              reason,

              remainingConnections:
                result.current,
            },
            "Socket disconnected"
          );

          /*
           * Token refresh, brief Wi-Fi loss, browser
           * network transitions, etc. may reconnect
           * immediately.
           *
           * Wait before announcing OFFLINE.
           */
          if (
            result
              .becameOffline
          ) {
            setTimeout(
              async () => {
                /*
                 * Another connection came back during
                 * the grace period.
                 */
                if (
                  presenceStore
                    .isOnline(
                      userId
                    )
                ) {
                  return;
                }

                try {
                  await presenceService
                    .publishOffline(
                      io,
                      userId
                    );
                } catch (
                  error
                ) {
                  logger.error(
                    {
                      err:
                        error,

                      userId,
                    },
                    "Failed to publish offline presence"
                  );
                }
              },
              5000
            );
          }
        }
      );
    }
  );

  return io;
}

module.exports = {
  initializeSocket,
};