"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserSession = sequelize.define(
  "UserSession",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      field: "id",
    },

    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "user_id",
    },

    sessionId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "session_id",
    },

    refreshTokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "refresh_token_hash",
    },

    refreshGeneration: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "refresh_generation",
    },

    familyId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "family_id",
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },

    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_used_at",
    },

    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "revoked_at",
    },

    revokeReason: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "revoke_reason",
    },

    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: "ip_address",
    },

    userAgent: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: "user_agent",
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
    tableName: "user_sessions",

    timestamps: true,

    createdAt: "createdAt",
    updatedAt: "updatedAt",

    indexes: [
      {
        unique: true,
        fields: ["session_id"],
      },
      {
        unique: true,
        fields: ["refresh_token_hash"],
      },
      {
        fields: ["user_id"],
      },
      {
        fields: ["family_id"],
      },
      {
        fields: ["expires_at"],
      },
    ],
  }
);

module.exports = UserSession;