"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "conversation_members",
      "last_read_message_id",
      {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,

        references: {
          model: "messages",
          key: "id",
        },

        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      }
    );

    await queryInterface.addColumn(
      "conversation_members",
      "last_read_at",
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );

    await queryInterface.addIndex(
      "conversation_members",
      ["last_read_message_id"],
      {
        name:
          "idx_conversation_members_last_read_message",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "conversation_members",
      "idx_conversation_members_last_read_message"
    );

    await queryInterface.removeColumn(
      "conversation_members",
      "last_read_at"
    );

    await queryInterface.removeColumn(
      "conversation_members",
      "last_read_message_id"
    );
  },
};