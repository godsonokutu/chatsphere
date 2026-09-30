"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            "notification_outbox",
            {
                id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true
                },

                user_id: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false,

                    references: {
                        model: "users",
                        key: "id"
                    },

                    onUpdate: "CASCADE",
                    onDelete: "RESTRICT"
                },

                channel: {
                    type: Sequelize.ENUM(
                        "EMAIL",
                        "SMS"
                    ),
                    allowNull: false
                },

                template: {
                    type: Sequelize.STRING(100),
                    allowNull: false
                },

                recipient: {
                    type: Sequelize.STRING(254),
                    allowNull: false
                },

                payload_ciphertext: {
                    type: Sequelize.TEXT("long"),
                    allowNull: false
                },

                payload_iv: {
                    type: Sequelize.STRING(24),
                    allowNull: false
                },

                payload_auth_tag: {
                    type: Sequelize.STRING(32),
                    allowNull: false
                },

                key_version: {
                    type: Sequelize.INTEGER.UNSIGNED,
                    allowNull: false
                },

                aad: {
                    type: Sequelize.STRING(255),
                    allowNull: false
                },

                status: {
                    type: Sequelize.ENUM(
                        "PENDING",
                        "PROCESSING",
                        "SENT",
                        "FAILED"
                    ),
                    allowNull: false,
                    defaultValue: "PENDING"
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

                available_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue:
                        Sequelize.literal(
                            "CURRENT_TIMESTAMP"
                        )
                },

                locked_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },

                sent_at: {
                    type: Sequelize.DATE,
                    allowNull: true
                },

                last_error_code: {
                    type: Sequelize.STRING(100),
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
            "notification_outbox",
            [
                "status",
                "available_at",
                "id"
            ],
            {
                name:
                    "idx_notification_outbox_dispatch"
            }
        );

        await queryInterface.addIndex(
            "notification_outbox",
            ["user_id"],
            {
                name:
                    "idx_notification_outbox_user_id"
            }
        );

        await queryInterface.addIndex(
            "notification_outbox",
            [
                "status",
                "locked_at"
            ],
            {
                name:
                    "idx_notification_outbox_recovery"
            }
        );

        await queryInterface.sequelize.query(`
            ALTER TABLE \`notification_outbox\`
            ADD CONSTRAINT \`chk_notification_outbox_attempts\`
            CHECK (
                \`attempt_count\` <= \`max_attempts\`
            )
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE \`notification_outbox\`
            ADD CONSTRAINT \`chk_notification_outbox_max_attempts\`
            CHECK (
                \`max_attempts\` > 0
            )
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE \`notification_outbox\`
            MODIFY COLUMN \`updated_at\`
            DATETIME NOT NULL
            DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP
        `);
    },

    async down(queryInterface) {
        await queryInterface.dropTable(
            "notification_outbox"
        );
    }
};