const nodemailer = require("nodemailer");
const env = require("./env");

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,

    requireTLS: true,

    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD
    },

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
});

module.exports = transporter;