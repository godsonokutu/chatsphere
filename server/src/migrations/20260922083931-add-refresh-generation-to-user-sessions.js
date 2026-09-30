"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "user_sessions",
      "refresh_generation",
      {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "user_sessions",
      "refresh_generation"
    );
  },
};