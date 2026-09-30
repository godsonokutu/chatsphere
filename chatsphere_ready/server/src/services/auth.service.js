const sequelize = require("../config/db");
const env = require("../config/env");
const authValidator = require("../validators/auth.validator");

const crypto = require("crypto");

const jwtConfig =
  require("../config/jwt.config");

const userSessionRepository =
  require("../repositories/userSession.repository");

const {
  verifyPassword
} = require("../utils/password");

const {
  generateSessionId,
  generateFamilyId,
  createAccessToken,
  createRefreshToken,
  parseAndVerifyRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
  calculateSessionExpiry,
} = require("../utils/token");

const REFRESH_REPLAY_GRACE_MS =
  10 * 1000;

const userRepository =
    require("../repositories/user.repository");

const verificationChallengeRepository =
    require("../repositories/verificationChallenge.repository");

const notificationOutboxRepository =
    require("../repositories/notificationOutbox.repository");

const {
    validateRegistrationInput
} = require("../validators/auth.validator");

const {
    normalizeUsername,
    normalizeEmail,
    normalizePhoneNumber
} = require("../utils/identity");

const {
    hashPassword
} = require("../utils/password");

const {
    generateVerificationCode,
    hashVerificationCode,
    verifyVerificationCode
} = require("../utils/verificationCode");

const {
    encryptJson
} = require("../utils/encryption");

const AppError =
    require("../errors/AppError");

const ERROR_CODES =
    require("../errors/errorCodes");

const errorCodes =
    ERROR_CODES;

const dummyPasswordHashPromise = hashPassword(
  crypto.randomBytes(32).toString("hex")
);


/*
 * Creates a verification challenge
 * and its corresponding notification
 * outbox job.
 *
 * The challenge and outbox job are
 * created inside the caller's
 * transaction.
 */
async function createVerificationChallengeAndJob({
    user,
    type,
    target,
    transaction
}) {
    const code =
        generateVerificationCode();

    const secretHash =
        hashVerificationCode({
            code,
            userId: user.id,
            type,
            target,
            secret:
                env.VERIFICATION_HMAC_SECRET
        });

    const expiresAt =
        new Date(
            Date.now() +
                10 * 60 * 1000
        );

    const challenge =
        await verificationChallengeRepository
            .createChallenge(
                {
                    userId:
                        user.id,

                    type,

                    target,

                    secretHash,

                    expiresAt,

                    maxAttempts:
                        5
                },
                {
                    transaction
                }
            );

    const aad =
        `verification:${user.id}:${challenge.id}`;

    const encrypted =
        encryptJson(
            {
                verificationCode:
                    code
            },
            aad
        );

    await notificationOutboxRepository
        .createJob(
            {
                userId:
                    user.id,

                channel:
                    type ===
                    "EMAIL_VERIFICATION"
                        ? "EMAIL"
                        : "SMS",

                template:
                    "ACCOUNT_VERIFICATION",

                recipient:
                    target,

                payloadCiphertext:
                    encrypted.ciphertext,

                payloadIv:
                    encrypted.iv,

                payloadAuthTag:
                    encrypted.authTag,

                keyVersion:
                    encrypted.keyVersion,

                aad,

                status:
                    "PENDING",

                attemptCount:
                    0,

                maxAttempts:
                    5,

                availableAt:
                    new Date()
            },
            {
                transaction
            }
        );

    return {
        challenge,

        channel:
            type ===
            "EMAIL_VERIFICATION"
                ? "EMAIL"
                : "SMS"
    };
}


/*
 * REGISTER
 */
async function register(input) {
    const validation =
        validateRegistrationInput(
            input
        );

    if (!validation.success) {
        throw new AppError({
            code:
                ERROR_CODES.VALIDATION
                    .INVALID_INPUT,

            statusCode:
                400,

            publicMessage:
                "Invalid registration details",

            publicDetails:
                validation.error
                    .flatten()
                    .fieldErrors,

            internalMessage:
                "Registration validation failed"
        });
    }


    const username =
        normalizeUsername(
            validation.data.username
        );


    const email =
        validation.data.email
            ? normalizeEmail(
                  validation.data.email
              )
            : null;


    const phoneNumber =
        validation.data.phoneNumber
            ? normalizePhoneNumber(
                  validation.data.phoneNumber
              )
            : null;


    if (!email && !phoneNumber) {
        throw new AppError({
            code:
                ERROR_CODES.VALIDATION
                    .INVALID_INPUT,

            statusCode:
                400,

            publicMessage:
                "A valid email or phone number is required",

            internalMessage:
                "Registration identity normalization failed"
        });
    }


    const conflicts =
        await userRepository
            .findRegistrationConflicts({
                username,
                email,
                phoneNumber
            });


    for (
        const existingUser
        of conflicts
    ) {
        if (
            existingUser.username ===
            username
        ) {
            throw new AppError({
                code:
                    ERROR_CODES.USER
                        .USERNAME_ALREADY_EXISTS,

                statusCode:
                    409,

                publicMessage:
                    "Username is already in use"
            });
        }


        if (
            email &&
            existingUser.email ===
                email
        ) {
            throw new AppError({
                code:
                    ERROR_CODES.USER
                        .EMAIL_ALREADY_EXISTS,

                statusCode:
                    409,

                publicMessage:
                    "Email is already in use"
            });
        }


        if (
            phoneNumber &&
            existingUser
                .phoneNumber ===
                phoneNumber
        ) {
            throw new AppError({
                code:
                    ERROR_CODES.USER
                        .PHONE_ALREADY_EXISTS,

                statusCode:
                    409,

                publicMessage:
                    "Phone number is already in use"
            });
        }
    }


    const passwordHash =
        await hashPassword(
            validation.data.password
        );


    return sequelize.transaction(
        async (transaction) => {

            const user =
                await userRepository
                    .createUser(
                        {
                            username,
                            email,
                            phoneNumber,
                            passwordHash
                        },
                        {
                            transaction
                        }
                    );


            const type =
                email
                    ? "EMAIL_VERIFICATION"
                    : "PHONE_VERIFICATION";


            const target =
                email ||
                phoneNumber;


            const {
                channel
            } =
                await createVerificationChallengeAndJob({
                    user,
                    type,
                    target,
                    transaction
                });


            return {
                id:
                    String(user.id),

                username:
                    user.username,

                email:
                    user.email,

                phoneNumber:
                    user.phoneNumber,

                verificationRequired:
                    true,

                verificationChannel:
                    channel
            };
        }
    );
}


async function resendVerification({
    email,
    phoneNumber
}) {
    let user;
    let type;
    let target;

    /*
     * Resolve the supplied identity.
     *
     * Public responses from this function
     * must not reveal whether an account
     * exists, is already verified, is under
     * cooldown, or actually received a new
     * verification code.
     */
    if (email) {
        target =
            normalizeEmail(
                email
            );

        if (target) {
            user =
                await userRepository
                    .findByEmail(
                        target
                    );
        }

        type =
            "EMAIL_VERIFICATION";

    } else if (phoneNumber) {
        target =
            normalizePhoneNumber(
                phoneNumber
            );

        if (target) {
            user =
                await userRepository
                    .findByPhoneNumber(
                        target
                    );
        }

        type =
            "PHONE_VERIFICATION";

    } else {
        throw new AppError({
            code:
                ERROR_CODES.VALIDATION
                    .INVALID_INPUT,

            statusCode:
                400,

            publicMessage:
                "Email or phone number is required"
        });
    }

    /*
     * Generic response used for:
     *
     * - nonexistent account
     * - malformed/unresolvable identity
     * - already verified account
     * - resend cooldown
     * - successful resend
     *
     * The caller must not be able to
     * distinguish these states.
     */
    const genericResult = {
        accepted:
            true
    };

    /*
     * Do not reveal whether the account
     * exists.
     */
    if (
        !user ||
        !target
    ) {
        return genericResult;
    }

    /*
     * Do not reveal that the identity is
     * already verified.
     */
    const alreadyVerified =
        type ===
        "EMAIL_VERIFICATION"
            ? Boolean(
                  user.emailVerifiedAt
              )
            : Boolean(
                  user.phoneVerifiedAt
              );

    if (alreadyVerified) {
        return genericResult;
    }

    await sequelize.transaction(
        async (transaction) => {

            /*
             * Serialize resend attempts against
             * the latest challenge.
             */
            const latestChallenge =
                await verificationChallengeRepository
                    .findLatestForVerification(
                        {
                            userId:
                                user.id,

                            type,

                            target
                        },
                        {
                            transaction,
                            lock:
                                true
                        }
                    );

            /*
             * Internal 60-second cooldown.
             *
             * IMPORTANT:
             * We intentionally do NOT return a
             * different HTTP-visible result when
             * cooldown is active.
             */
            if (
                latestChallenge &&
                latestChallenge.createdAt
            ) {
                const createdAt =
                    new Date(
                        latestChallenge
                            .createdAt
                    ).getTime();

                const elapsedMs =
                    Date.now() -
                    createdAt;

                const cooldownMs =
                    60 * 1000;

                if (
                    Number.isFinite(
                        createdAt
                    ) &&
                    elapsedMs >= 0 &&
                    elapsedMs <
                        cooldownMs
                ) {
                    return;
                }
            }

            /*
             * Invalidate previous unconsumed
             * verification challenges before
             * creating the replacement.
             */
            await verificationChallengeRepository
                .invalidateUnconsumedChallenges(
                    {
                        userId:
                            user.id,

                        type,

                        target
                    },
                    {
                        transaction
                    }
                );

            /*
             * Create the replacement challenge
             * and queue its notification in the
             * same transaction.
             */
            await createVerificationChallengeAndJob({
                user,
                type,
                target,
                transaction
            });
        }
    );

    /*
     * Always return the same public shape.
     */
    return genericResult;
}

/*
 * VERIFY ACCOUNT
 */
async function verifyAccount({
    email,
    phoneNumber,
    code
}) {
    /*
     * Verification codes are always
     * exactly six decimal digits.
     */
    if (
        typeof code !== "string" ||
        !/^\d{6}$/.test(code)
    ) {
        throw new AppError({
            code:
                ERROR_CODES.VERIFICATION
                    .INVALID_CODE,

            statusCode:
                400,

            publicMessage:
                "Invalid verification code"
        });
    }


    let user;
    let type;
    let target;


    if (email) {
        target =
            normalizeEmail(
                email
            );

        if (target) {
            user =
                await userRepository
                    .findByEmail(
                        target
                    );
        }

        type =
            "EMAIL_VERIFICATION";

    } else if (phoneNumber) {

        target =
            normalizePhoneNumber(
                phoneNumber
            );

        if (target) {
            user =
                await userRepository
                    .findByPhoneNumber(
                        target
                    );
        }

        type =
            "PHONE_VERIFICATION";

    } else {

        throw new AppError({
            code:
                ERROR_CODES.VALIDATION
                    .INVALID_INPUT,

            statusCode:
                400,

            publicMessage:
                "Email or phone number is required"
        });
    }


    if (!user || !target) {
        throw new AppError({
            code:
                ERROR_CODES.VERIFICATION
                    .INVALID_CODE,

            statusCode:
                400,

            publicMessage:
                "Invalid verification request"
        });
    }


    /*
     * IMPORTANT:
     *
     * Failed verification attempts must
     * be committed before an AppError is
     * thrown.
     *
     * Therefore invalid-code results are
     * returned from the transaction and
     * converted to AppError AFTER commit.
     */
    const result =
        await sequelize.transaction(
            async (transaction) => {

                const challenge =
                    await verificationChallengeRepository
                        .findLatestForVerification(
                            {
                                userId:
                                    user.id,

                                type,

                                target
                            },
                            {
                                transaction,
                                lock:
                                    true
                            }
                        );


                if (!challenge) {
                    throw new AppError({
                        code:
                            ERROR_CODES
                                .VERIFICATION
                                .CHALLENGE_NOT_FOUND,

                        statusCode:
                            400,

                        publicMessage:
                            "No verification challenge found"
                    });
                }


                if (
                    challenge.consumedAt
                ) {
                    throw new AppError({
                        code:
                            ERROR_CODES
                                .VERIFICATION
                                .CODE_ALREADY_USED,

                        statusCode:
                            400,

                        publicMessage:
                            "Verification code has already been used"
                    });
                }


                if (
                    new Date() >=
                    new Date(
                        challenge.expiresAt
                    )
                ) {
                    throw new AppError({
                        code:
                            ERROR_CODES
                                .VERIFICATION
                                .CODE_EXPIRED,

                        statusCode:
                            400,

                        publicMessage:
                            "Verification code has expired"
                    });
                }


                if (
                    Number(
                        challenge
                            .attemptCount
                    ) >=
                    Number(
                        challenge
                            .maxAttempts
                    )
                ) {
                    throw new AppError({
                        code:
                            ERROR_CODES
                                .VERIFICATION
                                .TOO_MANY_ATTEMPTS,

                        statusCode:
                            429,

                        publicMessage:
                            "Too many verification attempts"
                    });
                }


                const isValid =
                    verifyVerificationCode({
                        submittedCode:
                            code,

                        storedHash:
                            challenge
                                .secretHash,

                        userId:
                            user.id,

                        type,

                        target,

                        secret:
                            env.VERIFICATION_HMAC_SECRET
                    });


                if (!isValid) {

                    const nextAttemptCount =
                        Number(
                            challenge
                                .attemptCount
                        ) + 1;


                    await verificationChallengeRepository
                        .incrementAttemptCount(
                            challenge,
                            {
                                transaction
                            }
                        );


                    /*
                     * Do not throw here.
                     *
                     * Returning lets Sequelize
                     * commit attempt_count.
                     */
                    if (
                        nextAttemptCount >=
                        Number(
                            challenge
                                .maxAttempts
                        )
                    ) {
                        return {
                            verified:
                                false,

                            error: {
                                code:
                                    ERROR_CODES
                                        .VERIFICATION
                                        .TOO_MANY_ATTEMPTS,

                                statusCode:
                                    429,

                                publicMessage:
                                    "Too many verification attempts"
                            }
                        };
                    }


                    return {
                        verified:
                            false,

                        error: {
                            code:
                                ERROR_CODES
                                    .VERIFICATION
                                    .INVALID_CODE,

                            statusCode:
                                400,

                            publicMessage:
                                "Invalid verification code"
                        }
                    };
                }


                /*
                 * Valid OTP.
                 *
                 * Consume the challenge and
                 * verify the corresponding
                 * identity atomically.
                 */
                await verificationChallengeRepository
                    .consumeChallenge(
                        challenge,
                        {
                            transaction
                        }
                    );


                const verifiedAt =
                    new Date();


                if (
                    type ===
                    "EMAIL_VERIFICATION"
                ) {
                    user.emailVerifiedAt =
                        verifiedAt;

                } else {
                    user.phoneVerifiedAt =
                        verifiedAt;
                }


                await user.save({
                    fields: [
                        type ===
                        "EMAIL_VERIFICATION"
                            ? "emailVerifiedAt"
                            : "phoneVerifiedAt"
                    ],

                    transaction
                });


                return {
                    verified:
                        true,

                    channel:
                        type ===
                        "EMAIL_VERIFICATION"
                            ? "EMAIL"
                            : "SMS"
                };
            }
        );


    /*
     * The transaction has committed by
     * this point.
     *
     * It is now safe to throw an error
     * for an invalid attempt.
     */
    if (!result.verified) {
        throw new AppError({
            code:
                result.error.code,

            statusCode:
                result.error
                    .statusCode,

            publicMessage:
                result.error
                    .publicMessage
        });
    }


    return result;
}

async function login(
  {
    email,
    phoneNumber,
    password,
  },
  context = {}
) {
  // ------------------------------------------
  // 1. Validate request
  // ------------------------------------------

  const input =
    authValidator.validateLoginInput({
      email,
      phoneNumber,
      password,
    });

  // ------------------------------------------
  // 2. Normalize identity
  // ------------------------------------------

  let normalizedEmail = null;
  let normalizedPhoneNumber = null;

  if (input.email) {
    normalizedEmail =
      normalizeEmail(input.email);
  }

  if (input.phoneNumber) {
    normalizedPhoneNumber =
      normalizePhoneNumber(
        input.phoneNumber
      );
  }

  // ------------------------------------------
  // 3. Load authentication record
  // ------------------------------------------

  const user =
    await userRepository.findForAuthentication({
      email: normalizedEmail,
      phoneNumber:
        normalizedPhoneNumber,
    });

  // ------------------------------------------
  // 4. Password verification
  // ------------------------------------------

  if (!user) {
    // Perform roughly equivalent expensive
    // password work even when no account exists.
    const dummyHash =
      await dummyPasswordHashPromise;

    await verifyPassword(
      input.password,
      dummyHash
    );

    throw new AppError({
      code:
        errorCodes.AUTH
          .INVALID_CREDENTIALS,

      statusCode: 401,

      publicMessage:
        "Invalid credentials.",

      internalMessage:
        "Login failed: account not found.",
    });
  }

  const passwordIsValid =
    await verifyPassword(
      input.password,
      user.passwordHash
    );

  if (!passwordIsValid) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .INVALID_CREDENTIALS,

      statusCode: 401,

      publicMessage:
        "Invalid credentials.",

      internalMessage:
        `Login failed: invalid password for user ${user.id}.`,
    });
  }

  // ------------------------------------------
  // 5. Account status
  // ------------------------------------------

  if (user.status === "SUSPENDED") {
    throw new AppError({
      code:
        errorCodes.AUTH
          .ACCOUNT_SUSPENDED,

      statusCode: 403,

      publicMessage:
        "This account is currently suspended.",

      internalMessage:
        `Suspended user ${user.id} attempted login.`,
    });
  }

  if (user.status === "DEACTIVATED") {
    throw new AppError({
      code:
        errorCodes.AUTH
          .ACCOUNT_DEACTIVATED,

      statusCode: 403,

      publicMessage:
        "This account is deactivated.",

      internalMessage:
        `Deactivated user ${user.id} attempted login.`,
    });
  }

  // ------------------------------------------
  // 6. Require verification of the identity
  //    actually being used to login.
  // ------------------------------------------

  if (
    normalizedEmail &&
    !user.emailVerifiedAt
  ) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .ACCOUNT_NOT_VERIFIED,

      statusCode: 403,

      publicMessage:
        "Please verify your account before logging in.",

      internalMessage:
        `User ${user.id} attempted email login without verified email.`,
    });
  }

  if (
    normalizedPhoneNumber &&
    !user.phoneVerifiedAt
  ) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .ACCOUNT_NOT_VERIFIED,

      statusCode: 403,

      publicMessage:
        "Please verify your account before logging in.",

      internalMessage:
        `User ${user.id} attempted phone login without verified phone.`,
    });
  }

  // ------------------------------------------
  // 7. Create session material
  // ------------------------------------------

  const sessionId =
    generateSessionId();

  const familyId =
    generateFamilyId();

  const refreshGeneration = 0;

  const refreshToken =
    createRefreshToken({
      sessionId,
      generation:
        refreshGeneration,
    });

  const refreshTokenHash =
    hashRefreshToken(refreshToken);

  const expiresAt =
    calculateSessionExpiry();

  // ------------------------------------------
  // 8. Persist session
  // ------------------------------------------

  await userSessionRepository.createSession({
    userId: user.id,

    sessionId,

    refreshTokenHash,

    refreshGeneration,

    familyId,

    expiresAt,

    lastUsedAt: new Date(),

    revokedAt: null,

    revokeReason: null,

    ipAddress:
      context.ipAddress || null,

    userAgent:
      context.userAgent || null,
  });

  // ------------------------------------------
  // 9. Create short-lived access token
  // ------------------------------------------

  const accessToken =
    createAccessToken({
      userId: user.id,
      sessionId,
    });

  // ------------------------------------------
  // 10. Return safe authentication result
  // ------------------------------------------

  return {
    user: {
      id: String(user.id),

      username: user.username,

      email: user.email,

      phoneNumber:
        user.phoneNumber,

      status: user.status,

      emailVerified:
        Boolean(
          user.emailVerifiedAt
        ),

      phoneVerified:
        Boolean(
          user.phoneVerifiedAt
        ),
    },

    accessToken,

    accessTokenExpiresIn:
  jwtConfig.accessTokenTtlSeconds,

    refreshToken,
  };
}

async function refreshSession(
  refreshToken,
  context = {}
) {
  if (
    typeof refreshToken !== "string" ||
    refreshToken.length === 0
  ) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .INVALID_REFRESH_TOKEN,

      statusCode: 401,

      publicMessage:
        "Authentication required.",

      internalMessage:
        "Refresh request did not contain a refresh token.",
    });
  }

  // -----------------------------------------
  // 1. Verify structure + HMAC before DB work
  // -----------------------------------------

  let tokenData;

  try {
    tokenData =
      parseAndVerifyRefreshToken(
        refreshToken
      );
  } catch (error) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .INVALID_REFRESH_TOKEN,

      statusCode: 401,

      publicMessage:
        "Authentication required.",

      internalMessage:
        "Refresh token failed structural or HMAC verification.",

      cause: error,
    });
  }

  const now = new Date();

  // -----------------------------------------
  // 2. Serialize refresh operations for this
  //    session using a DB row lock
  // -----------------------------------------

  const result =
    await sequelize.transaction(
      async (transaction) => {
        const session =
          await userSessionRepository
            .findBySessionId(
              tokenData.sessionId,
              {
                transaction,
                lock: true,
              }
            );

        if (!session) {
          return {
            error: {
              code:
                errorCodes.AUTH
                  .INVALID_REFRESH_TOKEN,

              statusCode: 401,

              publicMessage:
                "Authentication required.",

              internalMessage:
                "Refresh token referenced a nonexistent session.",
            },
          };
        }

        // -------------------------------------
        // 3. Reject revoked sessions
        // -------------------------------------

        if (session.revokedAt) {
          return {
            error: {
              code:
                errorCodes.AUTH
                  .SESSION_REVOKED,

              statusCode: 401,

              publicMessage:
                "Your session is no longer valid. Please log in again.",

              internalMessage:
                `Refresh attempted for revoked session ${session.sessionId}.`,
            },
          };
        }

        // -------------------------------------
        // 4. Reject expired sessions
        // -------------------------------------

        if (
          new Date(session.expiresAt) <=
          now
        ) {
          await userSessionRepository
            .revokeSession(
              session,
              "SESSION_EXPIRED",
              { transaction }
            );

          return {
            error: {
              code:
                errorCodes.AUTH
                  .SESSION_EXPIRED,

              statusCode: 401,

              publicMessage:
                "Your session has expired. Please log in again.",

              internalMessage:
                `Expired session ${session.sessionId} attempted refresh.`,
            },
          };
        }

        const currentGeneration =
          Number(
            session.refreshGeneration
          );

        const suppliedGeneration =
          tokenData.generation;

        // -------------------------------------
        // 5. Older token presented
        // -------------------------------------

        if (
          suppliedGeneration <
          currentGeneration
        ) {
          const generationsBehind =
            currentGeneration -
            suppliedGeneration;

          const lastRotationTime =
            session.lastUsedAt
              ? new Date(
                  session.lastUsedAt
                ).getTime()
              : 0;

          const millisecondsSinceRotation =
            Date.now() -
            lastRotationTime;

          // Immediately previous token within
          // grace window:
          //
          // reject it, but don't destroy the
          // valid newly-rotated session.
          if (
            generationsBehind === 1 &&
            millisecondsSinceRotation >= 0 &&
            millisecondsSinceRotation <=
              REFRESH_REPLAY_GRACE_MS
          ) {
            return {
              error: {
                code:
                  errorCodes.AUTH
                    .REFRESH_ALREADY_ROTATED,

                statusCode: 401,

                publicMessage:
                  "The session was already refreshed.",

                internalMessage:
                  `Concurrent stale refresh detected for session ${session.sessionId}.`,
              },
            };
          }

          // Older authentic refresh token being
          // reused outside concurrency grace.
          await userSessionRepository
            .revokeSession(
              session,
              "REFRESH_TOKEN_REUSE_DETECTED",
              { transaction }
            );

          return {
            error: {
              code:
                errorCodes.AUTH
                  .REFRESH_TOKEN_REUSE_DETECTED,

              statusCode: 401,

              publicMessage:
                "Your session is no longer valid. Please log in again.",

              internalMessage:
                `Refresh-token reuse detected for session ${session.sessionId}.`,
            },
          };
        }

        // -------------------------------------
        // 6. Future generation is impossible
        // -------------------------------------

        if (
          suppliedGeneration >
          currentGeneration
        ) {
          return {
            error: {
              code:
                errorCodes.AUTH
                  .INVALID_REFRESH_TOKEN,

              statusCode: 401,

              publicMessage:
                "Authentication required.",

              internalMessage:
                `Refresh generation ${suppliedGeneration} exceeded current generation ${currentGeneration}.`,
            },
          };
        }

        // -------------------------------------
        // 7. Verify complete token hash
        // -------------------------------------

        const tokenHashMatches =
          verifyRefreshTokenHash(
            refreshToken,
            session.refreshTokenHash
          );

        if (!tokenHashMatches) {
          // HMAC was valid and the session +
          // generation were valid, but the
          // actual issued token differs.
          // Treat this as suspicious.

          await userSessionRepository
            .revokeSession(
              session,
              "REFRESH_TOKEN_HASH_MISMATCH",
              { transaction }
            );

          return {
            error: {
              code:
                errorCodes.AUTH
                  .INVALID_REFRESH_TOKEN,

              statusCode: 401,

              publicMessage:
                "Your session is no longer valid. Please log in again.",

              internalMessage:
                `Refresh-token hash mismatch for session ${session.sessionId}.`,
            },
          };
        }

        // -------------------------------------
        // 8. Check current user/account state
        // -------------------------------------

        const user =
          await userRepository
            .findAuthStateById(
              session.userId,
              { transaction }
            );

        if (!user) {
          await userSessionRepository
            .revokeSession(
              session,
              "USER_NOT_FOUND",
              { transaction }
            );

          return {
            error: {
              code:
                errorCodes.AUTH
                  .INVALID_REFRESH_TOKEN,

              statusCode: 401,

              publicMessage:
                "Authentication required.",

              internalMessage:
                `Session ${session.sessionId} referenced a missing user.`,
            },
          };
        }

        if (
          user.status === "SUSPENDED"
        ) {
          await userSessionRepository
            .revokeSession(
              session,
              "ACCOUNT_SUSPENDED",
              { transaction }
            );

          return {
            error: {
              code:
                errorCodes.AUTH
                  .ACCOUNT_SUSPENDED,

              statusCode: 403,

              publicMessage:
                "This account is currently suspended.",

              internalMessage:
                `Suspended user ${user.id} attempted session refresh.`,
            },
          };
        }

        if (
          user.status ===
          "DEACTIVATED"
        ) {
          await userSessionRepository
            .revokeSession(
              session,
              "ACCOUNT_DEACTIVATED",
              { transaction }
            );

          return {
            error: {
              code:
                errorCodes.AUTH
                  .ACCOUNT_DEACTIVATED,

              statusCode: 403,

              publicMessage:
                "This account is deactivated.",

              internalMessage:
                `Deactivated user ${user.id} attempted session refresh.`,
            },
          };
        }

        // -------------------------------------
        // 9. Rotate refresh token
        // -------------------------------------

        const nextGeneration =
          currentGeneration + 1;

        const nextRefreshToken =
          createRefreshToken({
            sessionId:
              session.sessionId,

            generation:
              nextGeneration,
          });

        const nextRefreshTokenHash =
          hashRefreshToken(
            nextRefreshToken
          );

        // Generate access JWT BEFORE committing
        // the refresh rotation.
        //
        // If signing somehow fails, transaction
        // rolls back and current refresh token
        // remains usable.
        const accessToken =
          createAccessToken({
            userId: user.id,

            sessionId:
              session.sessionId,
          });

        await userSessionRepository
          .rotateRefreshToken(
            session,
            {
              refreshTokenHash:
                nextRefreshTokenHash,

              refreshGeneration:
                nextGeneration,

              lastUsedAt: now,

              ipAddress:
                context.ipAddress ||
                session.ipAddress,

              userAgent:
                context.userAgent ||
                session.userAgent,
            },
            { transaction }
          );

        return {
          success: true,

          refreshToken:
            nextRefreshToken,

          accessToken,

          accessTokenExpiresIn:
            jwtConfig
              .accessTokenTtlSeconds,

          user: {
            id: String(user.id),

            username:
              user.username,

            email:
              user.email,

            phoneNumber:
              user.phoneNumber,

            status:
              user.status,
          },
        };
      }
    );

  // -----------------------------------------
  // 10. Throw after transaction has committed
  //     any security revocation decision
  // -----------------------------------------

  if (result.error) {
    throw new AppError({
      code:
        result.error.code,

      statusCode:
        result.error.statusCode,

      publicMessage:
        result.error.publicMessage,

      internalMessage:
        result.error.internalMessage,
    });
  }

  return result;
}

async function logout(
  sessionId
) {
  if (!sessionId) {
    throw new AppError({
      code:
        errorCodes.AUTH
          .AUTHENTICATION_REQUIRED,

      statusCode: 401,

      publicMessage:
        "Authentication required.",

      internalMessage:
        "Logout attempted without session ID.",
    });
  }

  await userSessionRepository
    .revokeBySessionId(
      sessionId,
      "USER_LOGOUT"
    );

  return {
    loggedOut: true,
  };
}


module.exports =
    Object.freeze({
        register,
        verifyAccount,
        resendVerification,
        login,
        refreshSession,
        logout
    });