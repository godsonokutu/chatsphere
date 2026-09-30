const { Op } = require("sequelize");
const VerificationChallenge =
    require("../models/VerificationChallenge");


function createChallenge(data, options = {}) {
    return VerificationChallenge.create(data, {
        transaction: options.transaction
    });
}


function findActiveChallenge(
    {
        userId,
        type,
        target
    },
    options = {}
) {
    const queryOptions = {
        where: {
            userId,
            type,
            target,

            consumedAt: null,

            expiresAt: {
                [Op.gt]: new Date()
            },

            [Op.and]: [
                {
                    attemptCount: {
                        [Op.lt]:
                            VerificationChallenge.sequelize.col(
                                "max_attempts"
                            )
                    }
                }
            ]
        },

        order: [
            ["createdAt", "DESC"]
        ],

        transaction: options.transaction
    };

    if (
        options.lock &&
        options.transaction
    ) {
        queryOptions.lock =
            options.transaction.LOCK.UPDATE;
    }

    return VerificationChallenge.findOne(
        queryOptions
    );
}

/**
 * Invalidates every currently unconsumed challenge
 * for the same identity.
 *
 * We intentionally invalidate expired challenges too.
 * This leaves no old unconsumed challenge behind when
 * a replacement challenge is issued.
 */
function invalidateUnconsumedChallenges(
    {
        userId,
        type,
        target
    },
    options = {}
) {
    return VerificationChallenge.update(
        {
            consumedAt: new Date()
        },
        {
            where: {
                userId,
                type,
                target,
                consumedAt: null
            },

            transaction: options.transaction
        }
    );
}

/**
 * Finds a challenge by ID for verification.
 *
 * The service will use a row lock while checking and
 * consuming it so concurrent verification requests
 * cannot both successfully consume the same challenge.
 */
function findByIdForVerification(
    challengeId,
    options = {}
) {
    const queryOptions = {
        where: {
            id: challengeId
        },

        transaction: options.transaction
    };

    if (
        options.lock &&
        options.transaction
    ) {
        queryOptions.lock =
            options.transaction.LOCK.UPDATE;
    }

    return VerificationChallenge.findOne(
        queryOptions
    );
}

function incrementAttemptCount(
    challenge,
    options = {}
) {
    return challenge.increment(
        "attemptCount",
        {
            by: 1,
            transaction: options.transaction
        }
    );
}

function consumeChallenge(
    challenge,
    options = {}
) {
    challenge.consumedAt = new Date();

    return challenge.save({
        fields: ["consumedAt"],
        transaction: options.transaction
    });
}

function findLatestForVerification(
    { userId, type, target },
    options = {}
) {
    const queryOptions = {
        where: {
            userId,
            type,
            target
        },

        order: [
            ["createdAt", "DESC"],
            ["id", "DESC"]
        ],

        transaction: options.transaction
    };

    if (options.lock && options.transaction) {
        queryOptions.lock =
            options.transaction.LOCK.UPDATE;
    }

    return VerificationChallenge.findOne(
        queryOptions
    );
}


module.exports = Object.freeze({
    createChallenge,
    findActiveChallenge,
    invalidateUnconsumedChallenges,
    findByIdForVerification,
    incrementAttemptCount,
    consumeChallenge,
    findLatestForVerification
});