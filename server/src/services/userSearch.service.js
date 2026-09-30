"use strict";

const userSearchRepository =
  require("../repositories/userSearch.repository");

const {
  validateUserSearch,
} =
  require("../validators/userSearch.validator");

async function searchUsers({
  currentUserId,
  query,
  limit,
}) {
  const input =
    validateUserSearch({
      q: query,
      limit,
    });

  const rows =
    await userSearchRepository
      .searchActiveUsers({
        currentUserId:
          String(
            currentUserId
          ),

        query:
          input.q,

        limit:
          input.limit,
      });

  return {
    users:
      rows.map(
        (row) => ({
          id:
            String(
              row.id
            ),

          username:
            row.username,
        })
      ),
  };
}

module.exports = {
  searchUsers,
};