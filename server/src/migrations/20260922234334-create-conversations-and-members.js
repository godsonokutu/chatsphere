"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("conversations", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      type: {
        type: Sequelize.ENUM(
          "DIRECT",
          "GROUP"
        ),
        allowNull: false,
      },

      // Only DIRECT conversations use this.
      // Example: "5:12"
      direct_key: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      // Used by GROUP conversations later.
      title: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },

      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,

        references: {
          model: "users",
          key: "id",
        },

        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue:
          Sequelize.literal(
            "CURRENT_TIMESTAMP"
          ),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue:
          Sequelize.literal(
            "CURRENT_TIMESTAMP"
          ),
      },
    });

    await queryInterface.addIndex(
      "conversations",
      ["direct_key"],
      {
        name:
          "uq_conversations_direct_key",
        unique: true,
      }
    );

    await queryInterface.addIndex(
      "conversations",
      ["type"],
      {
        name:
          "idx_conversations_type",
      }
    );

    await queryInterface.addIndex(
      "conversations",
      ["last_message_at"],
      {
        name:
          "idx_conversations_last_message_at",
      }
    );

    // -------------------------------------

    await queryInterface.createTable(
      "conversation_members",
      {
        id: {
          type:
            Sequelize.BIGINT.UNSIGNED,

          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },

        conversation_id: {
          type:
            Sequelize.BIGINT.UNSIGNED,

          allowNull: false,

          references: {
            model: "conversations",
            key: "id",
          },

          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        user_id: {
          type:
            Sequelize.BIGINT.UNSIGNED,

          allowNull: false,

          references: {
            model: "users",
            key: "id",
          },

          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        role: {
          type: Sequelize.ENUM(
            "OWNER",
            "ADMIN",
            "MEMBER"
          ),

          allowNull: false,
          defaultValue: "MEMBER",
        },

        joined_at: {
          type: Sequelize.DATE,
          allowNull: false,

          defaultValue:
            Sequelize.literal(
              "CURRENT_TIMESTAMP"
            ),
        },

        left_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        created_at: {
          type: Sequelize.DATE,
          allowNull: false,

          defaultValue:
            Sequelize.literal(
              "CURRENT_TIMESTAMP"
            ),
        },

        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,

          defaultValue:
            Sequelize.literal(
              "CURRENT_TIMESTAMP"
            ),
        },
      }
    );

    await queryInterface.addIndex(
      "conversation_members",
      [
        "conversation_id",
        "user_id",
      ],
      {
        name:
          "uq_conversation_members_pair",

        unique: true,
      }
    );

    await queryInterface.addIndex(
      "conversation_members",
      ["user_id", "left_at"],
      {
        name:
          "idx_conversation_members_user_active",
      }
    );

    await queryInterface.addIndex(
      "conversation_members",
      [
        "conversation_id",
        "left_at",
      ],
      {
        name:
          "idx_conversation_members_conversation_active",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      "conversation_members"
    );

    await queryInterface.dropTable(
      "conversations"
    );
  },
};