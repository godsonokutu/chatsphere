const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const NotificationOutbox = sequelize.define(
    "NotificationOutbox",
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },

        userId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            field: "user_id"
        },

        channel: {
            type: DataTypes.ENUM("EMAIL", "SMS"),
            allowNull: false
        },

        template: {
            type: DataTypes.STRING(100),
            allowNull: false
        },

        recipient: {
            type: DataTypes.STRING(254),
            allowNull: false
        },

        payloadCiphertext: {
            type: DataTypes.TEXT("long"),
            allowNull: false,
            field: "payload_ciphertext"
        },

        payloadIv: {
            type: DataTypes.STRING(24),
            allowNull: false,
            field: "payload_iv"
        },

        payloadAuthTag: {
            type: DataTypes.STRING(32),
            allowNull: false,
            field: "payload_auth_tag"
        },

        keyVersion: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            field: "key_version"
        },

        aad: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        status: {
            type: DataTypes.ENUM(
                "PENDING",
                "PROCESSING",
                "SENT",
                "FAILED"
            ),
            allowNull: false,
            defaultValue: "PENDING"
        },

        attemptCount: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "attempt_count"
        },

        maxAttempts: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 5,
            field: "max_attempts"
        },

        availableAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "available_at"
        },

        lockedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "locked_at"
        },

        sentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "sent_at"
        },

        lastErrorCode: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: "last_error_code"
        }
    },
    {
        tableName: "notification_outbox",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at"
    }
);

module.exports = NotificationOutbox;