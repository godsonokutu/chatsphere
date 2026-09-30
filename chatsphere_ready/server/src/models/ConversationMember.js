"use strict";

const {
  DataTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

const ConversationMember =
  sequelize.define(
    "ConversationMember",
    {
      id: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      conversationId: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        field:
          "conversation_id",
      },

      userId: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        field: "user_id",
      },

      role: {
        type: DataTypes.ENUM(
          "OWNER",
          "ADMIN",
          "MEMBER"
        ),

        allowNull: false,

        defaultValue: "MEMBER",
      },

      joinedAt: {
        type: DataTypes.DATE,
        allowNull: false,

        field: "joined_at",
      },

      leftAt: {
        type: DataTypes.DATE,
        allowNull: true,

        field: "left_at",
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,

        field: "created_at",
      },

      lastReadMessageId: {
  type: DataTypes.BIGINT.UNSIGNED,
  allowNull: true,
  field: "last_read_message_id",
},

lastReadAt: {
  type: DataTypes.DATE,
  allowNull: true,
  field: "last_read_at",
},

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,

        field: "updated_at",
      },
    },
    {
      tableName:
        "conversation_members",

      timestamps: true,

      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

module.exports =
  ConversationMember;