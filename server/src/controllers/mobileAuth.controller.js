"use strict";

const { ZodError } = require("zod");
const AppError = require("../errors/AppError");

// The service owns credential checks, rotation, reuse detection and revocation.
// Only the token transport differs from the browser's HttpOnly cookie flow.
function createMobileAuthController(authService) {
  const forward = (error, next) =>
    next(
      error instanceof ZodError
        ? new AppError({
            code: "INVALID_INPUT",
            statusCode: 400,
            publicMessage: "Please check your sign-in details.",
          })
        : error,
    );
  const context = (req) => ({
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get("user-agent") || null,
  });

  function respond(req, res, result) {
    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        accessTokenExpiresIn: result.accessTokenExpiresIn,
        refreshToken: result.refreshToken,
      },
      requestId: req.id,
    });
  }

  return {
    async login(req, res, next) {
      res.set("Cache-Control", "no-store");
      res.set("Pragma", "no-cache");
      try {
        return respond(
          req,
          res,
          await authService.login(req.body || {}, context(req)),
        );
      } catch (error) {
        return forward(error, next);
      }
    },
    async refresh(req, res, next) {
      res.set("Cache-Control", "no-store");
      res.set("Pragma", "no-cache");
      try {
        // Deliberately never falls back to a browser cookie.
        return respond(
          req,
          res,
          await authService.refreshSession(
            req.body?.refreshToken,
            context(req),
          ),
        );
      } catch (error) {
        return forward(error, next);
      }
    },
  };
}

module.exports = { createMobileAuthController };
