"use strict";

const {
  z,
} = require("zod");

const searchSchema =
  z.object({
    q:
      z
        .string()
        .trim()
        .min(
          2,
          "Enter at least 2 characters."
        )
        .max(
          50,
          "Search text is too long."
        ),

    limit:
      z
        .coerce
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10),
  });

function validateUserSearch(
  input
) {
  return searchSchema.parse(
    input
  );
}

module.exports = {
  validateUserSearch,
};