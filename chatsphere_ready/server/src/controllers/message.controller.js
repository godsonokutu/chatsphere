"use strict";

const messageService =
  require("../services/message.service");

async function sendMessage(
  req,
  res,
  next
) {
  try {
    const result =
      await messageService
        .sendMessage({
          conversationId:
            req.params
              .conversationId,

          senderId:
            req.auth.userId,

          clientMessageId:
            req.body
              .clientMessageId,

          content:
            req.body.content,
        });

    return res
      .status(
        result.created
          ? 201
          : 200
      )
      .json({
        success: true,

        message:
          result.created
            ? "Message sent."
            : "Message already processed.",

        data:
          result.message,

        requestId:
          req.id,
      });
  } catch (error) {
    next(error);
  }
}

async function getMessages(
  req,
  res,
  next
) {
  try {
    const result =
      await messageService
        .getMessages({
          conversationId:
            req.params
              .conversationId,

          userId:
            req.auth.userId,

          before:
            req.query.before,

          limit:
            req.query.limit,
        });

    return res
      .status(200)
      .json({
        success: true,

        data: result,

        requestId:
          req.id,
      });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendMessage,
  getMessages,
};