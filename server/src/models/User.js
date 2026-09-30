const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define(
    "User",
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },

        username: {
            type: DataTypes.STRING(30),
            allowNull: false,
            unique: true
        },

        email: {
            type: DataTypes.STRING(254),
            allowNull: true,
            unique: true
        },

        phoneNumber: {
            type: DataTypes.STRING(20),
            allowNull: true,
            unique: true,
            field: "phone_number"
        },

        passwordHash: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: "password_hash"
        },

        emailVerifiedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "email_verified_at"
        },

        phoneVerifiedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "phone_verified_at"
        },

        status: {
            type: DataTypes.ENUM(
                "ACTIVE",
                "SUSPENDED",
                "DEACTIVATED"
            ),
            allowNull: false,
            defaultValue: "ACTIVE"
        },

        lastSeenAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "last_seen_at"
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
},

deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: "deleted_at"
}
    },
    {
        tableName: "users",

        timestamps: true,

        paranoid: true,

        createdAt: "createdAt",
        updatedAt: "updatedAt",
        deletedAt: "deletedAt",
        defaultScope: {
            attributes: {
                exclude: ["passwordHash"]
            }
        },

        scopes: {
            withPasswordHash: {
                attributes: {
                    include: ["passwordHash"]
                }
            }
        }
    }
);

module.exports = User;