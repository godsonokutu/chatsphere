"use strict";

const conversationInboxService =
  require("../services/conversationInbox.service");

async function listConversations(
  req,
  res,
  next
) {
  try {
    const result =
      await conversationInboxService
        .listConversations({
          userId:
            req.auth.userId,

          cursor:
            req.query.cursor,

          limit:
            req.query.limit,
        });

    return res
      .status(200)
      .json({
        success:
          true,

        data:
          result,

        requestId:
          req.id,
      });
  } catch (
    error
  ) {
    next(error);
  }
}

module.exports = {
  listConversations,
};