"use strict";

const userSearchService =
  require("../services/userSearch.service");

async function searchUsers(
  req,
  res,
  next
) {
  try {
    const result =
      await userSearchService
        .searchUsers({
          currentUserId:
            req.auth.userId,

          query:
            req.query.q,

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
  searchUsers,
};