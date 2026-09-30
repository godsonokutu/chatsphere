"use strict";

function userRoom(
  userId
) {
  return `user:${String(
    userId
  )}`;
}

function conversationRoom(
  conversationId
) {
  return `conversation:${String(
    conversationId
  )}`;
}

module.exports = {
  userRoom,
  conversationRoom,
};