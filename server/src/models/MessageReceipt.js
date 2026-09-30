"use strict";

const {
  DataTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

const MessageReceipt =
  sequelize.define(
    "MessageReceipt",
    {
      id: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      messageId: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        field: "message_id",
      },

      userId: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        field: "user_id",
      },

      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true,

        field: "delivered_at",
      },

      readAt: {
        type: DataTypes.DATE,
        allowNull: true,

        field: "read_at",
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,

        field: "created_at",
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,

        field: "updated_at",
      },
    },
    {
      tableName:
        "message_receipts",

      timestamps: true,

      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

module.exports =
  MessageReceipt;