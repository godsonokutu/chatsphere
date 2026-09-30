"use strict";

const conversationRepository =
  require("../repositories/conversation.repository");

const userRepository =
  require("../repositories/user.repository");

const {
  userRoom,
} = require("../sockets/rooms");

async function notifyRelatedUsers(
  io,
  userId,
  payload
) {
  const relatedUserIds =
    await conversationRepository
      .findRelatedUserIds(
        userId
      );

  for (
    const relatedUserId
    of relatedUserIds
  ) {
    io.to(
      userRoom(
        relatedUserId
      )
    ).emit(
      "presence:update",
      payload
    );
  }
}

async function publishOnline(
  io,
  userId
) {
  const payload = {
    userId:
      String(userId),

    status: "ONLINE",

    lastSeenAt: null,
  };

  await notifyRelatedUsers(
    io,
    userId,
    payload
  );

  return payload;
}

async function publishOffline(
  io,
  userId
) {
  const lastSeenAt =
    new Date();

  await userRepository
    .updateLastSeenAt(
      userId,
      lastSeenAt
    );

  const payload = {
    userId:
      String(userId),

    status: "OFFLINE",

    lastSeenAt,
  };

  await notifyRelatedUsers(
    io,
    userId,
    payload
  );

  return payload;
}

module.exports = {
  publishOnline,
  publishOffline,
};