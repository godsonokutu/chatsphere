"use strict";

const {
  QueryTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

// ======================================================
// SEARCH ACTIVE USERS
//
// Security/privacy:
// - never return email
// - never return phone
// - never return password/security fields
// - exclude the requesting user
//
// Prefix search keeps this compatible with the
// username index.
// ======================================================

async function searchActiveUsers({
  currentUserId,
  query,
  limit,
}) {
  return sequelize.query(
    `
    SELECT
      id,
      username
    FROM users
    WHERE
      status = 'ACTIVE'
      AND deleted_at IS NULL
      AND id <> :currentUserId
      AND username LIKE CONCAT(:query, '%')
    ORDER BY username ASC, id ASC
    LIMIT :limit
    `,
    {
      replacements: {
        currentUserId,
        query,
        limit,
      },

      type:
        QueryTypes.SELECT,
    }
  );
}

module.exports = {
  searchActiveUsers,
};