"use strict";

const { Op } = require("sequelize");
const UserSession = require("../models/UserSession");

async function createSession(data, options = {}) {
  return UserSession.create(data, {
    transaction: options.transaction,
  });
}

async function findBySessionId(sessionId, options = {}) {
  const queryOptions = {
    where: {
      sessionId,
    },
    transaction: options.transaction,
  };

  if (options.lock && options.transaction) {
    queryOptions.lock = options.transaction.LOCK.UPDATE;
  }

  return UserSession.findOne(queryOptions);
}

async function findActiveBySessionId(sessionId, options = {}) {
  const queryOptions = {
    where: {
      sessionId,

      revokedAt: null,

      expiresAt: {
        [Op.gt]: new Date(),
      },
    },

    transaction: options.transaction,
  };

  if (options.lock && options.transaction) {
    queryOptions.lock = options.transaction.LOCK.UPDATE;
  }

  return UserSession.findOne(queryOptions);
}

async function rotateRefreshToken(
  session,
  {
    refreshTokenHash,
    refreshGeneration,
    lastUsedAt = new Date(),
    ipAddress,
    userAgent,
  },
  options = {}
) {
  session.refreshTokenHash = refreshTokenHash;
  session.refreshGeneration = refreshGeneration;
  session.lastUsedAt = lastUsedAt;

  if (ipAddress !== undefined) {
    session.ipAddress = ipAddress;
  }

  if (userAgent !== undefined) {
    session.userAgent = userAgent;
  }

  return session.save({
    transaction: options.transaction,
  });
}

async function revokeSession(
  session,
  reason,
  options = {}
) {
  if (session.revokedAt) {
    return session;
  }

  session.revokedAt = new Date();
  session.revokeReason = reason;

  return session.save({
    transaction: options.transaction,
  });
}

async function revokeBySessionId(
  sessionId,
  reason,
  options = {}
) {
  return UserSession.update(
    {
      revokedAt: new Date(),
      revokeReason: reason,
    },
    {
      where: {
        sessionId,
        revokedAt: null,
      },

      transaction: options.transaction,
    }
  );
}

async function revokeAllForUser(
  userId,
  reason,
  options = {}
) {
  return UserSession.update(
    {
      revokedAt: new Date(),
      revokeReason: reason,
    },
    {
      where: {
        userId,
        revokedAt: null,
      },

      transaction: options.transaction,
    }
  );
}

async function findActiveSessionsForUser(
  userId,
  options = {}
) {
  return UserSession.findAll({
    where: {
      userId,

      revokedAt: null,

      expiresAt: {
        [Op.gt]: new Date(),
      },
    },

    order: [["createdAt", "DESC"]],

    transaction: options.transaction,
  });
}

async function deleteExpiredSessions(
  before = new Date(),
  options = {}
) {
  return UserSession.destroy({
    where: {
      expiresAt: {
        [Op.lt]: before,
      },
    },

    transaction: options.transaction,
  });
}

module.exports = {
  createSession,
  findBySessionId,
  findActiveBySessionId,
  rotateRefreshToken,
  revokeSession,
  revokeBySessionId,
  revokeAllForUser,
  findActiveSessionsForUser,
  deleteExpiredSessions,
};