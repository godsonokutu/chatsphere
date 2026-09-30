'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id:
      {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      username:
      {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true
      },

      email:
      {
        type: Sequelize.STRING(254),
        allowNull: true,
        unique: true
      },

      phoneNumber:
      {
        type: Sequelize.STRING(20),
        allowNull: true,
        unique: true
      },

      passwordHash:
      {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      emailVerifiedAt: 
      {
        type: Sequelize.DATE,
        allowNull: true
      },

      phoneVerifiedAt: 
      {
        type: Sequelize.DATE,
        allowNull: true
      },

      status:
      {
        type: Sequelize.ENUM("ACTIVE", "SUSPENDED", "DEACTIVATED"),
        allowNull: false,
        defaultValue: "ACTIVE"
      
      },

      lastSeenAt:
      {
        type: Sequelize.DATE,
        allowNull: true
      },

      createdAt:
      {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },

      updatedAt: 
      {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },

      deletedAt:
      {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    await queryInterface.addConstraint("users", {
      fields: ["email", "phoneNumber"],
      type: "check",
      name: "users_email_or_phone_required",
      where: {
        [Sequelize.Op.or]: [{
          email: {
            [Sequelize.Op.ne]: null
          }},
          {
            phoneNumber:{
              [Sequelize.Op.ne]: null
            }
          }
        ]
      }
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY updatedAt DATETIME NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP`);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable("users");
  }
};
