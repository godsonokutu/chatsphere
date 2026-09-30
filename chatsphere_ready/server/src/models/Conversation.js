"use strict";

const {
  DataTypes,
} = require("sequelize");

const sequelize =
  require("../config/db");

const Conversation =
  sequelize.define(
    "Conversation",
    {
      id: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      type: {
        type: DataTypes.ENUM(
          "DIRECT",
          "GROUP"
        ),

        allowNull: false,
      },

      directKey: {
        type: DataTypes.STRING(50),
        allowNull: true,

        field: "direct_key",
      },

      title: {
        type:
          DataTypes.STRING(120),

        allowNull: true,
      },

      createdBy: {
        type:
          DataTypes.BIGINT.UNSIGNED,

        allowNull: true,

        field: "created_by",
      },

      lastMessageAt: {
        type: DataTypes.DATE,
        allowNull: true,

        field: "last_message_at",
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
      tableName: "conversations",

      timestamps: true,

      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

module.exports = Conversation;