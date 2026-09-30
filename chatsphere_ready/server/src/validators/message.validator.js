"use strict";

const { z } = require("zod");

const mysqlUnsignedBigInt =
  18446744073709551615n;

const bigintIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[1-9]\d{0,19}$/,
      "Invalid ID"
    )
    .refine(
      (value) => {
        try {
          return (
            BigInt(value) <=
            mysqlUnsignedBigInt
          );
        } catch {
          return false;
        }
      },
      {
        message:
          "ID is outside the supported range",
      }
    );

const clientMessageIdSchema =
  z
    .string()
    .trim()
    .min(16)
    .max(64)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Invalid clientMessageId"
    );

const sendMessageSchema =
  z.object({
    clientMessageId:
      clientMessageIdSchema,

    content:
      z
        .string()
        .min(1)
        .max(4000)
        .refine(
          (value) =>
            value.trim().length > 0,
          {
            message:
              "Message cannot be empty",
          }
        ),
  });

const paginationSchema =
  z.object({
    before:
      bigintIdSchema.optional(),

    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(30),
  });

function validateConversationId(
  value
) {
  return bigintIdSchema.parse(
    String(value)
  );
}

function validateSendMessage(
  input
) {
  return sendMessageSchema.parse(
    input
  );
}

function validatePagination(
  input
) {
  return paginationSchema.parse(
    input
  );
}

function validateMessageId(
  value
) {
  return bigintIdSchema.parse(
    String(value)
  );
}


module.exports = {
  validateConversationId,
  validateSendMessage,
  validatePagination,
    validateMessageId,
};