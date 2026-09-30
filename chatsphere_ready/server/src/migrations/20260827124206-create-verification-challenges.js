"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            "verification_challenges",
            {
                id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false
                },

                user_id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false,

                    references: {
                        model: "users",
                        key: "id"
                    },

                    onUpdate: "CASCADE",
                    onDelete: "CASCADE"
                },

                type: {
                    type: Sequelize.ENUM(
                        "EMAIL_VERIFICATION",
                        "PHONE_VERIFICATION"
                    ),
                    allowNull: false
                },

                target: {
                    type: Sequelize.STRING(254),
                    allowNull: false
                },

                secret_hash: {
                    type: Sequelize.STRING(128),
                    allowNull: false
                },

                expires_at: {
                    type: Sequelize.DATE,
                    allowNull: false
                },

                attempt_count: {
                    type: Sequelize.INTEGER.UNSIGNED,
                    allowNull: false,
                    defaultValue: 0
                },

                max_attempts: {
                    type: Sequelize.INTEGER.UNSIGNED,
                    allowNull: false,
                    defaultValue: 5
                },

                consumed_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },

                created_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue:
                        Sequelize.literal(
                            "CURRENT_TIMESTAMP"
                        )
                },

                updated_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue:
                        Sequelize.literal(
                            "CURRENT_TIMESTAMP"
                        )
                }
            }
        );

        await queryInterface.addIndex(
            "verification_challenges",
            [
                "user_id",
                "type",
                "target"
            ],
            {
                name:
                    "idx_verification_challenges_user_type_target"
            }
        );

        await queryInterface.addIndex(
            "verification_challenges",
            ["expires_at"],
            {
                name:
                    "idx_verification_challenges_expires_at"
            }
        );

        await queryInterface.sequelize.query(`
            ALTER TABLE \`verification_challenges\`
            ADD CONSTRAINT \`chk_verification_attempt_count\`
            CHECK (
                \`attempt_count\` <= \`max_attempts\`
            )
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE \`verification_challenges\`
            ADD CONSTRAINT \`chk_verification_max_attempts\`
            CHECK (
                \`max_attempts\` > 0
            )
        `);

        

        await queryInterface.sequelize.query(`
            ALTER TABLE \`verification_challenges\`
            MODIFY COLUMN \`updated_at\`
            DATETIME NOT NULL
            DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP
        `);

        await queryInterface.sequelize.query(`
    ALTER TABLE \`verification_challenges\`
    ADD CONSTRAINT \`chk_verification_expiry_after_creation\`
    CHECK (
        \`expires_at\` > \`created_at\`
    )
`);
    },

    

    async down(queryInterface) {
        await queryInterface.dropTable(
            "verification_challenges"
        );
    }
};