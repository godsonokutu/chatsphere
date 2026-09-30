"use strict";

const {
  DataTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

const Message = sequelize.define(
  "Message",
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

      field: "conversation_id",
    },

    senderId: {
      type:
        DataTypes.BIGINT.UNSIGNED,

      allowNull: true,

      field: "sender_id",
    },

    clientMessageId: {
      type: DataTypes.STRING(64),

      allowNull: false,

      field: "client_message_id",
    },

    type: {
      type:
        DataTypes.ENUM("TEXT"),

      allowNull: false,

      defaultValue: "TEXT",
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,

      field: "edited_at",
    },

    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,

      field: "deleted_at",
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
    tableName: "messages",

    timestamps: true,

    createdAt: "createdAt",
    updatedAt: "updatedAt",

    /*
     * Do not enable Sequelize paranoid here.
     * Message deletion semantics will be handled
     * explicitly later.
     */
    paranoid: false,
  }
);

module.exports = Message;