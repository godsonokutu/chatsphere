const transporter =
    require("../config/mail.config");

const env =
    require("../config/env");


async function sendVerificationEmail({
    recipient,
    verificationCode
}) {
    await transporter.sendMail({
        from: env.MAIL_FROM,

        to: recipient,

        subject:
            "Verify your ChatSphere account",

        text:
            `Your ChatSphere verification code is ${verificationCode}. ` +
            `This code expires in 10 minutes.`,

        html: `
            <div
                style="
                    font-family: Arial, sans-serif;
                    max-width: 500px;
                    margin: 0 auto;
                "
            >
                <h2>
                    Verify your ChatSphere account
                </h2>

                <p>
                    Use this verification code:
                </p>

                <div
                    style="
                        font-size: 30px;
                        font-weight: bold;
                        letter-spacing: 6px;
                        margin: 20px 0;
                    "
                >
                    ${verificationCode}
                </div>

                <p>
                    This code expires in
                    10 minutes.
                </p>

                <p>
                    If you did not create this
                    account, you can ignore this
                    message.
                </p>
            </div>
        `
    });
}


module.exports = Object.freeze({
    sendVerificationEmail
});