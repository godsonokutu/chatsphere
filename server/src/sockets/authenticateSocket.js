"use strict";

const {
  verifyAccessToken,
} = require("../utils/token");

const userSessionRepository =
  require("../repositories/userSession.repository");

const userRepository =
  require("../repositories/user.repository");

const AppError =
  require("../errors/AppError");

const errorCodes =
  require("../errors/errorCodes");

function getHandshakeToken(socket) {
  const authToken =
    socket.handshake?.auth?.token;

  if (
    typeof authToken === "string" &&
    authToken.trim()
  ) {
    return authToken.trim();
  }

  const authorization =
    socket.handshake?.headers
      ?.authorization;

  if (
    typeof authorization === "string" &&
    authorization.startsWith(
      "Bearer "
    )
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return null;
}

async function loadAuthenticatedState({
  userId,
  sessionId,
}) {
  const session =
    await userSessionRepository
      .findActiveBySessionId(
        sessionId
      );

  if (!session) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .SESSION_REVOKED,

      statusCode: 401,

      publicMessage:
        "Your session is no longer valid. Please log in again.",

      internalMessage:
        `Socket authentication failed for inactive session ${sessionId}.`,
    });
  }

  if (
    String(session.userId) !==
    String(userId)
  ) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .INVALID_ACCESS_TOKEN,

      statusCode: 401,

      publicMessage:
        "Authentication required.",

      internalMessage:
        `Socket token user ${userId} did not match session user ${session.userId}.`,
    });
  }

  const user =
    await userRepository
      .findAuthStateById(
        session.userId
      );

  if (!user) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .INVALID_ACCESS_TOKEN,

      statusCode: 401,

      publicMessage:
        "Authentication required.",

      internalMessage:
        `Socket session ${sessionId} references a missing user.`,
    });
  }

  if (
    user.status === "SUSPENDED"
  ) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .ACCOUNT_SUSPENDED,

      statusCode: 403,

      publicMessage:
        "This account is currently suspended.",

      internalMessage:
        `Suspended user ${user.id} attempted socket connection.`,
    });
  }

  if (
    user.status === "DEACTIVATED"
  ) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .ACCOUNT_DEACTIVATED,

      statusCode: 403,

      publicMessage:
        "This account is deactivated.",

      internalMessage:
        `Deactivated user ${user.id} attempted socket connection.`,
    });
  }

  return {
    session,
    user,
  };
}

async function authenticateSocket(
  socket,
  next
) {
  try {
    const token =
      getHandshakeToken(socket);

    if (!token) {
      const error =
        new Error(
          "Authentication required."
        );

      error.data = {
        code:
          errorCodes.AUTH
            .AUTHENTICATION_REQUIRED,
      };

      return next(error);
    }

    let payload;

    try {
      payload =
        verifyAccessToken(token);
    } catch {
      const error =
        new Error(
          "Authentication required."
        );

      error.data = {
        code:
          errorCodes.AUTH
            .INVALID_ACCESS_TOKEN,
      };

      return next(error);
    }

    const {
      session,
      user,
    } =
      await loadAuthenticatedState({
        userId: payload.sub,
        sessionId:
          payload.sid,
      });

    socket.data.auth = {
      userId:
        String(user.id),

      sessionId:
        session.sessionId,

      tokenExpiresAt:
        payload.exp,
    };

    return next();
  } catch (error) {
    const socketError =
      new Error(
        error.publicMessage ||
        "Authentication required."
      );

    socketError.data = {
      code:
        error.code ||
        errorCodes.AUTH
          .AUTHENTICATION_REQUIRED,
    };

    return next(socketError);
  }
}

/*
 * Used again before sensitive socket
 * operations such as sending messages.
 *
 * This prevents a socket that was opened
 * before logout/session revocation from
 * continuing to act indefinitely.
 */
async function assertSocketSessionActive(
  socket
) {
  const auth =
    socket.data?.auth;

  if (
    !auth?.userId ||
    !auth?.sessionId
  ) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .AUTHENTICATION_REQUIRED,

      statusCode: 401,

      publicMessage:
        "Authentication required.",

      internalMessage:
        "Socket authentication state missing.",
    });
  }

  /*
   * Defense in depth:
   *
   * Do not rely only on the expiry timer.
   * Every sensitive socket operation must
   * reject an expired access token.
   */
  const tokenExpiresAt =
    Number(
      auth.tokenExpiresAt
    );

  if (
    !Number.isFinite(
      tokenExpiresAt
    ) ||
    tokenExpiresAt * 1000 <=
      Date.now()
  ) {
    if (socket.connected) {
      socket.emit(
        "auth:expired"
      );

      socket.disconnect(
        true
      );
    }

    throw new AppError({
      code:
        errorCodes.AUTH
          .INVALID_ACCESS_TOKEN,

      statusCode: 401,

      publicMessage:
        "Authentication required.",

      internalMessage:
        `Expired socket access token for session ${auth.sessionId}.`,
    });
  }

  /*
   * Also verify that the underlying
   * database session and account are
   * still active.
   */
  return loadAuthenticatedState({
    userId:
      auth.userId,

    sessionId:
      auth.sessionId,
  });
}

function scheduleTokenExpiry(
  socket
) {
  const expiresAt =
    Number(
      socket.data?.auth
        ?.tokenExpiresAt
    );

  if (
  !Number.isFinite(
    expiresAt
  )
) {
  socket.emit(
    "auth:expired"
  );

  socket.disconnect(
    true
  );

  return;
}

  const delay =
    expiresAt * 1000 -
    Date.now();

  if (delay <= 0) {
    socket.emit(
      "auth:expired"
    );

    socket.disconnect(true);

    return;
  }

  const timer =
    setTimeout(() => {
      socket.emit(
        "auth:expired"
      );

      socket.disconnect(true);
    }, delay);

  socket.once(
    "disconnect",
    () => {
      clearTimeout(timer);
    }
  );
}

module.exports = {
  authenticateSocket,
  assertSocketSessionActive,
  scheduleTokenExpiry,
};