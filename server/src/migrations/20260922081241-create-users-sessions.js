"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_sessions", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // Identifies one login/device session.
      // We use a random opaque value rather than exposing the DB id.
      session_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      // Hash only. Never store the raw refresh token.
      refresh_token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      // All rotated refresh tokens originating from one login belong
      // to the same family. Useful for reuse/theft detection.
      family_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      revoke_reason: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      ip_address: {
        // Supports both IPv4 and IPv6 textual representations.
        type: Sequelize.STRING(45),
        allowNull: true,
      },

      user_agent: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("user_sessions", ["session_id"], {
      name: "uq_user_sessions_session_id",
      unique: true,
    });

    await queryInterface.addIndex("user_sessions", ["refresh_token_hash"], {
      name: "uq_user_sessions_refresh_token_hash",
      unique: true,
    });

    await queryInterface.addIndex("user_sessions", ["user_id"], {
      name: "idx_user_sessions_user_id",
    });

    await queryInterface.addIndex(
      "user_sessions",
      ["user_id", "revoked_at", "expires_at"],
      {
        name: "idx_user_sessions_user_active",
      }
    );

    await queryInterface.addIndex("user_sessions", ["family_id"], {
      name: "idx_user_sessions_family_id",
    });

    await queryInterface.addIndex("user_sessions", ["expires_at"], {
      name: "idx_user_sessions_expires_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_sessions");
  },
};