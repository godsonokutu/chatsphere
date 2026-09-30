const {
    parsePhoneNumberFromString
} = require("libphonenumber-js");

function normalizeUsername(username) {
    if (typeof username !== "string") {
        return null;
    }

    return username
        .normalize("NFKC")
        .trim()
        .toLowerCase();
}

function normalizeEmail(email) {
    if (typeof email !== "string") {
        return null;
    }

    return email
        .normalize("NFKC")
        .trim()
        .toLowerCase();
}

function normalizePhoneNumber(
    phoneNumber,
    defaultCountry = "GH"
) {
    if (typeof phoneNumber !== "string") {
        return null;
    }

    const input = phoneNumber.trim();

    if (!input) {
        return null;
    }

    const parsed =
        parsePhoneNumberFromString(
            input,
            defaultCountry
        );

    if (!parsed || !parsed.isValid()) {
        return null;
    }

    return parsed.number;
}

module.exports = Object.freeze({
    normalizeUsername,
    normalizeEmail,
    normalizePhoneNumber
});