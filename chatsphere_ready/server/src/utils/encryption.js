const crypto = require("crypto");
const env = require("../config/env");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const encryptionKey = Buffer.from(
    env.OUTBOX_ENCRYPTION_KEY,
    "base64"
);

function encryptJson(data, aad) {
    if (
        data === null ||
        typeof data !== "object"
    ) {
        throw new TypeError(
            "Encryption payload must be an object"
        );
    }

    if (
        typeof aad !== "string" ||
        aad.length === 0
    ) {
        throw new TypeError(
            "Encryption AAD is required"
        );
    }

    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(
        ALGORITHM,
        encryptionKey,
        iv
    );

    cipher.setAAD(
        Buffer.from(aad, "utf8")
    );

    const plaintext = Buffer.from(
        JSON.stringify(data),
        "utf8"
    );

    const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final()
    ]);

    const authTag =
        cipher.getAuthTag();

    return Object.freeze({
        ciphertext:
            ciphertext.toString("base64"),

        iv:
            iv.toString("base64"),

        authTag:
            authTag.toString("base64"),

        keyVersion:
            env.OUTBOX_ENCRYPTION_KEY_VERSION
    });
}

function decryptJson({
    ciphertext,
    iv,
    authTag,
    keyVersion,
    aad
}) {
    if (
        keyVersion !==
        env.OUTBOX_ENCRYPTION_KEY_VERSION
    ) {
        throw new Error(
            "Unsupported encryption key version"
        );
    }

    const decipher =
        crypto.createDecipheriv(
            ALGORITHM,
            encryptionKey,
            Buffer.from(iv, "base64")
        );

    decipher.setAAD(
        Buffer.from(aad, "utf8")
    );

    decipher.setAuthTag(
        Buffer.from(
            authTag,
            "base64"
        )
    );

    const plaintext = Buffer.concat([
        decipher.update(
            Buffer.from(
                ciphertext,
                "base64"
            )
        ),
        decipher.final()
    ]);

    return JSON.parse(
        plaintext.toString("utf8")
    );
}

module.exports = Object.freeze({
    encryptJson,
    decryptJson
});