const env = require("./env");

module.exports = Object.freeze({
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    host: env.DB_HOST,
    port: env.DB_PORT,
    dialect: "mysql",

    logging: env.NODE_ENV === "development",

    timezone: "+00:00",

    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

    retry: {
        max: 3
    },

    dialectOptions: {}
});