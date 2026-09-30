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

async function authenticate(
  req,
  res,
  next
) {
  try {
    const authorization =
      req.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      throw new AppError({
        code:
          errorCodes.AUTH
            .AUTHENTICATION_REQUIRED,

        statusCode: 401,

        publicMessage:
          "Authentication required.",

        internalMessage:
          "Missing Bearer access token.",
      });
    }

    const token =
      authorization
        .slice(7)
        .trim();

    if (!token) {
      throw new AppError({
        code:
          errorCodes.AUTH
            .AUTHENTICATION_REQUIRED,

        statusCode: 401,

        publicMessage:
          "Authentication required.",

        internalMessage:
          "Bearer token was empty.",
      });
    }

    let payload;

    try {
      payload =
        verifyAccessToken(token);
    } catch (error) {
      throw new AppError({
        code:
          errorCodes.AUTH
            .INVALID_ACCESS_TOKEN,

        statusCode: 401,

        publicMessage:
          "Authentication required.",

        internalMessage:
          "Access token verification failed.",

        cause: error,
      });
    }

    const userId =
      String(payload.sub);

    const sessionId =
      payload.sid;

    // ---------------------------------------
    // Confirm server-side session still valid
    // ---------------------------------------

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
          `No active session found for access token session ${sessionId}.`,
      });
    }

    // Protect against a valid token somehow
    // being paired with another user's session.
    if (
      String(session.userId) !==
      userId
    ) {
      throw new AppError({
        code:
          errorCodes.AUTH
            .INVALID_ACCESS_TOKEN,

        statusCode: 401,

        publicMessage:
          "Authentication required.",

        internalMessage:
          `Access token user ${userId} does not match session user ${session.userId}.`,
      });
    }

    // ---------------------------------------
    // Confirm account still exists/is active
    // ---------------------------------------

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
          `Session ${sessionId} references missing user ${session.userId}.`,
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
          `Suspended user ${user.id} attempted protected request.`,
      });
    }

    if (
      user.status ===
      "DEACTIVATED"
    ) {
      throw new AppError({
        code:
          errorCodes.AUTH
            .ACCOUNT_DEACTIVATED,

        statusCode: 403,

        publicMessage:
          "This account is deactivated.",

        internalMessage:
          `Deactivated user ${user.id} attempted protected request.`,
      });
    }

    req.auth = {
      userId:
        String(user.id),

      sessionId,

      user: {
        id:
          String(user.id),

        username:
          user.username,

        email:
          user.email,

        phoneNumber:
          user.phoneNumber,

        status:
          user.status,
      },
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;