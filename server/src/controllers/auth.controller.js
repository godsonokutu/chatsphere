const authService =
    require("../services/auth.service");

const authConfig =
  require("../config/auth.config");

const errorCodes =
  require("../errors/errorCodes");


async function register(
    req,
    res,
    next
) {
    try {
        const result =
            await authService
                .register(
                    req.body
                );

        return res
            .status(201)
            .json({
                success: true,

                message:
                    "Registration successful. Verification is required.",

                data:
                    result,

                requestId:
                    req.id
            });

    } catch (error) {
        return next(error);
    }
}


async function resendVerification(
    req,
    res,
    next
) {
    try {
        await authService
            .resendVerification(
                req.body
            );

        return res
            .status(200)
            .json({
                success: true,

                /*
                 * Deliberately identical response
                 * for:
                 *
                 * - nonexistent account
                 * - already verified account
                 * - resend cooldown
                 * - successful resend
                 *
                 * Never expose service internals
                 * such as sent/channel/cooldown.
                 */
                message:
                    "If verification is required, a new code will be sent.",

                data: {
                    accepted:
                        true
                },

                requestId:
                    req.id
            });

    } catch (error) {
        return next(error);
    }
}


async function verifyAccount(
    req,
    res,
    next
) {
    try {
        const result =
            await authService
                .verifyAccount(
                    req.body
                );

        return res
            .status(200)
            .json({
                success: true,

                message:
                    "Account verified successfully",

                data:
                    result,

                requestId:
                    req.id
            });

    } catch (error) {
        return next(error);
    }
}

async function login(req, res, next) {
  try {
    const result =
      await authService.login(
        req.body,
        {
          ipAddress:
            req.ip ||
            req.socket?.remoteAddress ||
            null,

          userAgent:
            req.get("user-agent") ||
            null,
        }
      );

    res.cookie(
      authConfig.refreshCookieName,
      result.refreshToken,
      authConfig.refreshCookieOptions
    );

    return res.status(200).json({
      success: true,

      message:
        "Login successful.",

      data: {
        user: result.user,

        accessToken:
          result.accessToken,

        accessTokenExpiresIn:
          result.accessTokenExpiresIn,
      },

      requestId: req.id,
    });
  } catch (error) {
    next(error);
  }
}

async function refreshSession(
  req,
  res,
  next
) {
  try {
    const refreshToken =
      req.cookies?.[
        authConfig
          .refreshCookieName
      ];

    const result =
      await authService
        .refreshSession(
          refreshToken,
          {
            ipAddress:
              req.ip ||
              req.socket
                ?.remoteAddress ||
              null,

            userAgent:
              req.get(
                "user-agent"
              ) || null,
          }
        );

    res.cookie(
      authConfig
        .refreshCookieName,

      result.refreshToken,

      authConfig
        .refreshCookieOptions
    );

    return res.status(200).json({
      success: true,

      message:
        "Session refreshed successfully.",

      data: {
        user: result.user,

        accessToken:
          result.accessToken,

        accessTokenExpiresIn:
          result
            .accessTokenExpiresIn,
      },

      requestId: req.id,
    });
  } catch (error) {
    // Do NOT blindly clear the cookie here.
    //
    // A concurrent request may be using the
    // newly rotated cookie while this request
    // carries the immediately previous token.

    if (
      error?.code ===
        errorCodes.AUTH
          .SESSION_EXPIRED ||
      error?.code ===
        errorCodes.AUTH
          .SESSION_REVOKED ||
      error?.code ===
        errorCodes.AUTH
          .REFRESH_TOKEN_REUSE_DETECTED
    ) {
      res.clearCookie(
        authConfig
          .refreshCookieName,

        authConfig
          .refreshCookieClearOptions
      );
    }

    next(error);
  }
}

async function logout(
  req,
  res,
  next
) {
  try {
    await authService.logout(
      req.auth.sessionId
    );

    res.clearCookie(
      authConfig
        .refreshCookieName,

      authConfig
        .refreshCookieClearOptions
    );

    return res.status(200).json({
      success: true,

      message:
        "Logout successful.",

      data: {
        loggedOut: true,
      },

      requestId: req.id,
    });
  } catch (error) {
    next(error);
  }
}


module.exports =
    Object.freeze({
        register,
        resendVerification,
        verifyAccount,
        login,
        refreshSession,
        logout
    });