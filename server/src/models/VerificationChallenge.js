const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const VerificationChallenge = sequelize.define(
    "VerificationChallenge",
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },

        userId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            field: "user_id"
        },

        type: {
            type: DataTypes.ENUM(
                "EMAIL_VERIFICATION",
                "PHONE_VERIFICATION"
            ),
            allowNull: false
        },

        target: {
            type: DataTypes.STRING(254),
            allowNull: false
        },

        secretHash: {
            type: DataTypes.STRING(128),
            allowNull: false,
            field: "secret_hash"
        },

        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "expires_at"
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

        consumedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "consumed_at"
        },

        createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: "created_at"
},

updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: "updated_at"
}
    },
    {
        tableName: "verification_challenges",

        timestamps: true,

        createdAt: "createdAt",
        updatedAt: "updatedAt",

        paranoid: false
    }
);

module.exports = VerificationChallenge;