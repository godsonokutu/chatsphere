const pino = require("pino");
const env = require("./env");

const logger = pino({
    level: env.LOG_LEVEL,

    redact: {
        paths: [
            "password",
            "passwordHash",
            "req.body.password",
            "req.body.passwordHash",
            "req.body.token",
            "req.body.refreshToken",
            "req.body.accessToken",
            "req.body.verificationCode",
            "req.body.resetCode",
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers['set-cookie']"
        ],

        censor: "[REDACTED]"
    },

    base:
        env.NODE_ENV === "production"
            ? undefined
            : {
                  env: env.NODE_ENV
              }
});

module.exports = logger;