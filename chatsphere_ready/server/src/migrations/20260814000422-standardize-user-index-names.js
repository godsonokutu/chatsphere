"use strict";

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE \`users\`
            RENAME INDEX \`username\` TO \`uq_users_username\`,
            RENAME INDEX \`email\` TO \`uq_users_email\`,
            RENAME INDEX \`phoneNumber\` TO \`uq_users_phone_number\`
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE \`users\`
            RENAME INDEX \`uq_users_username\` TO \`username\`,
            RENAME INDEX \`uq_users_email\` TO \`email\`,
            RENAME INDEX \`uq_users_phone_number\` TO \`phoneNumber\`
        `);
    }
};