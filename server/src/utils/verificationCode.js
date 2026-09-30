const crypto = require("crypto");

const OTP_LENGTH = 6;

function generateVerificationCode() {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = (10 ** OTP_LENGTH) - 1;

    return crypto
        .randomInt(min, max + 1)
        .toString();
}

function hashVerificationCode({
    code,
    userId,
    type,
    target,
    secret
}) {
    if (!secret) {
        throw new Error(
            "Verification HMAC secret is required"
        );
    }

    const payload = [
        String(userId),
        type,
        target,
        code
    ].join(":");

    return crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
}

function verifyVerificationCode({
    submittedCode,
    storedHash,
    userId,
    type,
    target,
    secret
}) {
    const calculatedHash =
        hashVerificationCode({
            code: submittedCode,
            userId,
            type,
            target,
            secret
        });

    const storedBuffer =
        Buffer.from(storedHash, "hex");

    const calculatedBuffer =
        Buffer.from(calculatedHash, "hex");

    if (
        storedBuffer.length !==
        calculatedBuffer.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        storedBuffer,
        calculatedBuffer
    );
}

module.exports = Object.freeze({
    generateVerificationCode,
    hashVerificationCode,
    verifyVerificationCode
});