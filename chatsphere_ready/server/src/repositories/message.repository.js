"use strict";

const {
  Op,
} = require("sequelize");

const Message =
  require("../models/Message");

const MessageReceipt =
  require("../models/MessageReceipt");

const Conversation =
  require("../models/Conversation");

async function createMessage(
  data,
  options = {}
) {
  return Message.create(
    data,
    {
      transaction:
        options.transaction,
    }
  );
}

async function findBySenderAndClientId(
  senderId,
  clientMessageId,
  options = {}
) {
  return Message.findOne({
    where: {
      senderId,
      clientMessageId,
    },

    transaction:
      options.transaction,
  });
}

async function createReceipts(
  messageId,
  userIds,
  options = {}
) {
  if (!userIds.length) {
    return [];
  }

  const rows =
    userIds.map((userId) => ({
      messageId,
      userId,

      deliveredAt: null,
      readAt: null,
    }));

  return MessageReceipt.bulkCreate(
    rows,
    {
      transaction:
        options.transaction,
    }
  );
}

async function updateConversationLastMessage(
  conversationId,
  timestamp,
  options = {}
) {
  return Conversation.update(
    {
      lastMessageAt: timestamp,
    },
    {
      where: {
        id: conversationId,
      },

      transaction:
        options.transaction,
    }
  );
}

async function listMessages({
  conversationId,
  beforeId,
  limit,
  joinedAt,
}) {
  const where = {
    conversationId,

    createdAt: {
      [Op.gte]: joinedAt,
    },
  };

  if (beforeId) {
    where.id = {
      [Op.lt]: beforeId,
    };
  }

  return Message.findAll({
    where,

    attributes: [
      "id",
      "conversationId",
      "senderId",
      "clientMessageId",
      "type",
      "content",
      "editedAt",
      "deletedAt",
      "createdAt",
    ],

    order: [
      ["id", "DESC"],
    ],

    limit: limit + 1,
  });
}

async function findMessageById(
  messageId,
  options = {}
) {
  return Message.findByPk(
    messageId,
    {
      transaction:
        options.transaction,
    }
  );
}

async function findReceipt(
  messageId,
  userId,
  options = {}
) {
  return MessageReceipt.findOne({
    where: {
      messageId,
      userId,
    },

    transaction:
      options.transaction,
  });
}

async function markDelivered(
  messageId,
  userId,
  deliveredAt = new Date(),
  options = {}
) {
  return MessageReceipt.update(
    {
      deliveredAt,
    },
    {
      where: {
        messageId,
        userId,
        deliveredAt: null,
      },

      transaction:
        options.transaction,
    }
  );
}

async function findInConversation(
  messageId,
  conversationId,
  options = {}
) {
  return Message.findOne({
    where: {
      id: messageId,
      conversationId,
    },

    attributes: [
      "id",
      "conversationId",
      "senderId",
      "createdAt",
    ],

    transaction:
      options.transaction,
  });
}

module.exports = {
  createMessage,

  findBySenderAndClientId,

  createReceipts,

  updateConversationLastMessage,

  listMessages,
    findMessageById,
    findReceipt,
    markDelivered,
    findInConversation,
};